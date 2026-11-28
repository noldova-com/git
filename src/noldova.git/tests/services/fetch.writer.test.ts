/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */
import assert from "node:assert/strict";
import { createServer } from "node:http";
import path from "node:path";

import "@noldova/context.core";
import { afterAll, afterEach, beforeAll, beforeEach, describe, onTestFinished, test } from "vitest";

import { FailureCode, GitCode, GitNames, UndoMode, UntrustedSource } from "@noldova/git.protocol";

import { CredentialsNeededException } from "../../src/exceptions/credentials-needed.exception.ts";
import { FetchNoUpstreamException } from "../../src/exceptions/fetch-no-upstream.exception.ts";
import { GitFailedException } from "../../src/exceptions/git-failed.exception.ts";
import type { GitFailureException } from "../../src/exceptions/git-failure.exception.ts";
import { HostKeyUnknownException } from "../../src/exceptions/host-key-unknown.exception.ts";
import { KeyRefusedException } from "../../src/exceptions/key-refused.exception.ts";
import { StatusMovedException } from "../../src/exceptions/status-moved.exception.ts";
import { UnsafeRepositoryException } from "../../src/exceptions/unsafe-repository.exception.ts";
import { RepositoryFolders } from "../../src/models/repository-folders.ts";
import { Resources } from "../../src/resources.ts";
import { FetchWriter } from "../../src/services/fetch.writer.ts";
import { Journal } from "../../src/services/journal.ts";
import { RefSnapshotReader } from "../../src/services/ref-snapshot.reader.ts";
import { StatusReader } from "../../src/services/status.reader.ts";
import { WriteRunner } from "../../src/services/write.runner.ts";
import { CleanUps } from "../fixtures/clean-ups.fixture.ts";
import { DesktopFixture } from "../fixtures/desktop.fixture.ts";
import { RepositoryFixture } from "../fixtures/repository.fixture.ts";
import { ScriptedRunnerFixture } from "../fixtures/scripted-runner.fixture.ts";

describe("FetchWriter", () => {
  let template: RepositoryFixture;
  let repository: RepositoryFixture;
  const cleanUps: CleanUps = new CleanUps();
  let supervisor: DesktopFixture;
  let runner: ScriptedRunnerFixture;
  let folders: RepositoryFolders;
  let remote: string;
  let commands: string[];

  beforeAll(async () => {
    template = await RepositoryFixture.createAsync();
  });

  afterAll(async () => {
    await template.disposeAsync();
  });

  beforeEach(async () => {
    repository = await RepositoryFixture.createAsync(template);
    cleanUps.add(() => repository.disposeAsync());
    supervisor = await DesktopFixture.createAsync(repository.supervisorEnvironment());
    cleanUps.add(() => supervisor.disposeAsync());
    runner = new ScriptedRunnerFixture(supervisor.context);
    commands = [];
    runner.starting = command => commands.push(command);
    folders = new RepositoryFolders(repository.folder, repository.gitFolder, repository.gitFolder);
    remote = path.join(repository.root, "remote.git");
  });

  afterEach(async () => {
    await cleanUps.runAsync();
  });

  const trackAsync = async (): Promise<void> => {
    await repository.runGitAsync(["clone", "--bare", "--quiet", repository.folder, remote]);
    await repository.runGitAsync(["remote", "add", "origin", remote]);
    await repository.runGitAsync(["fetch", "--quiet", "origin"]);
    await repository.runGitAsync(["branch", "--quiet", "--set-upstream-to=origin/main"]);
  };
  const advanceRemoteAsync = async (): Promise<string> => {
    const tree = (await repository.runGitAsync([`--git-dir=${remote}`, "rev-parse", "main^{tree}"])).trim();
    const commit = (await repository.runGitAsync([`--git-dir=${remote}`, "commit-tree", tree, "-p", "main", "-m", "Remote"])).trim();
    await repository.runGitAsync([`--git-dir=${remote}`, "update-ref", "refs/heads/main", commit]);
    return commit;
  };
  const revisionAsync = async (name: string): Promise<string> => (await repository.runGitAsync(["rev-parse", name])).trim();
  const fingerprintAsync = async (): Promise<string> => (await new StatusReader(runner).readAsync(folders)).fingerprint;
  const fetchAsync = async (basedOn?: string, allRemotes: boolean = false): Promise<void> =>
    await new WriteRunner(new StatusReader(runner), new RefSnapshotReader(runner), new Journal(), () => undefined, () => undefined)
      .runAsync(folders, basedOn ?? await fingerprintAsync(), new FetchWriter(runner, allRemotes), null);
  const refusal = (type: abstract new (...args: never[]) => GitFailureException, code: FailureCode, gitCode: GitCode | null, message: string): ((error: unknown) => boolean) => (error: unknown): boolean => {
    assert.ok(error instanceof type);
    assert.deepEqual([error.code, error.gitCode, error.message], [code, gitCode, message]);
    return true;
  };

  test("moves the upstream to the remote's newest commit and leaves the branch where it was, never asking and never undone", async () => {
    await trackAsync();
    const commit = await advanceRemoteAsync();
    const head = await revisionAsync("HEAD");
    const writer = new FetchWriter(runner);

    await fetchAsync();

    assert.deepEqual([await revisionAsync("origin/main"), await revisionAsync("HEAD")], [commit, head]);
    assert.ok(commands.some(t => t.startsWith("fetch --quiet --no-recurse-submodules")));
    assert.deepEqual([writer.method, writer.undo, await writer.requestAsync()], [GitNames.fetchMethod, UndoMode.None, null]);
  });

  test("fetches every remote with --all when asked, even on a branch without an upstream or a detached HEAD, leaving the branch where it was", async () => {
    await trackAsync();
    const other = path.join(repository.root, "other.git");
    await repository.runGitAsync(["clone", "--bare", "--quiet", remote, other]);
    await repository.runGitAsync(["remote", "add", "other", other]);
    const commit = await advanceRemoteAsync();
    await repository.runGitAsync(["branch", "--quiet", "--unset-upstream"]);
    const head = await revisionAsync("HEAD");

    await fetchAsync(undefined, true);
    await repository.runGitAsync(["checkout", "--quiet", "--detach"]);
    await fetchAsync(undefined, true);

    assert.deepEqual([await revisionAsync("origin/main"), await revisionAsync("other/main"), await revisionAsync("HEAD")], [commit, head, head]);
    assert.deepEqual(commands.filter(t => t.startsWith("fetch")).map(t => t.split(" ").slice(0, 4).join(" ")),
      ["fetch --quiet --no-recurse-submodules --all", "fetch --quiet --no-recurse-submodules --all"]);
  });

  test("refuses a status that has moved since the caller read it, without running git fetch", async () => {
    await trackAsync();

    await assert.rejects(fetchAsync("old"),
      refusal(StatusMovedException, FailureCode.Stale, null, "The repository changed since the status the write is based on, so nothing ran. Read the status again."));
    assert.ok(!commands.some(t => t.startsWith("fetch")));
  });

  test("refuses a branch without an upstream, one whose upstream is gone, and a detached HEAD, without running git fetch", async () => {
    const noUpstream = refusal(FetchNoUpstreamException, FailureCode.Git, GitCode.NoUpstream, "This branch has no upstream to fetch, or its upstream is gone. Publish it first.");

    await assert.rejects(fetchAsync(), noUpstream);
    await trackAsync();
    await repository.runGitAsync(["update-ref", "-d", "refs/remotes/origin/main"]);
    await assert.rejects(fetchAsync(), noUpstream);
    await repository.runGitAsync(["checkout", "--quiet", "--detach"]);
    await assert.rejects(fetchAsync(), noUpstream);
    assert.ok(!commands.some(t => t.startsWith("fetch")));
  });

  test("fails with git's output as untrusted text when git fetch fails otherwise, such as on a remote it can't reach", async () => {
    await trackAsync();
    await repository.runGitAsync(["remote", "set-url", "origin", path.join(repository.root, "missing.git")]);

    await assert.rejects(fetchAsync(), (error: unknown): boolean => {
      assert.ok(error instanceof GitFailedException);
      assert.deepEqual([error.code, error.gitCode, error.message, error.output?.source],
        [FailureCode.Unavailable, null, "git fetch failed; its output comes with the failure as untrusted text.", UntrustedSource.Repository]);
      assert.ok((error.output?.text ?? "").length > 0);
      return true;
    });
  });

  test("tells an unknown host key, a refused SSH key and a sign-in it can't give from the remote's real answers, as a pull does", async () => {
    await trackAsync();
    const sshAsync = async (errors: string): Promise<void> => {
      await repository.runGitAsync(["config", "core.sshCommand", `echo '${errors}' >&2; exit 255; :`]);
    };
    const server = createServer((_request, response) => response.writeHead(401, { "WWW-Authenticate": "Basic realm=\"repo\"" }).end());
    await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve));
    onTestFinished(() => new Promise<void>(resolve => server.close(() => resolve())));
    const address = server.address();
    assert.ok(Object.isObject(address));

    await repository.runGitAsync(["remote", "set-url", "origin", "ssh://git@example.invalid/team/repo.git"]);
    await sshAsync("Host key verification failed.");
    await assert.rejects(fetchAsync(), refusal(HostKeyUnknownException, FailureCode.Git, GitCode.HostKeyUnknown, Resources.pushHostKeyUnknown));
    await sshAsync("git@example.invalid: Permission denied (publickey).");
    await assert.rejects(fetchAsync(), refusal(KeyRefusedException, FailureCode.Git, GitCode.KeyRefused, Resources.pushKeyRefused));
    await repository.runGitAsync(["remote", "set-url", "origin", `http://127.0.0.1:${String(address.port)}/repo.git`]);
    await assert.rejects(fetchAsync(), refusal(CredentialsNeededException, FailureCode.Git, GitCode.CredentialsNeeded, Resources.pushCredentialsNeeded));
  });

  test("refuses a repository git calls unsafe, naming the folder git names, scripted since its ownership can change only between the repository read and the fetch", async () => {
    await trackAsync();
    runner.failing = "fetch --quiet";
    runner.failingCode = 128;
    runner.failingErrors = "fatal: detected dubious ownership in repository at '/work/library'\n";

    await assert.rejects(fetchAsync(), (error: unknown): boolean => {
      assert.ok(error instanceof UnsafeRepositoryException);
      assert.deepEqual([error.code, error.gitCode, error.folder, error.output?.text], [FailureCode.NotRepository, GitCode.UnsafeRepository, "/work/library", runner.failingErrors]);
      return true;
    });
  });
});
