/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */
import assert from "node:assert/strict";
import { chmod, mkdir, writeFile } from "node:fs/promises";
import { createServer } from "node:http";
import path from "node:path";

import { afterAll, afterEach, beforeAll, beforeEach, describe, onTestFinished, test } from "vitest";

import {
  DataDirectory, OwnershipLock, PermissionCenter, PermissionDecision, PermissionDetailKind, PermissionOption,
  RememberedPermissionStore, ShellDatabase, ShellMigrations, ToolDescriptor, ToolRegistry, ToolRisk, ToolSession
} from "@noldova/desktop.runtime";
import { FakeModuleLog } from "@noldova/desktop.runtime/testing";
import { FailureCode, GitCode, GitStatus, StatusUpstream } from "@noldova/git.protocol";

import { CredentialsNeededException } from "../../src/exceptions/credentials-needed.exception.ts";
import { GitFailedException } from "../../src/exceptions/git-failed.exception.ts";
import type { GitFailureException } from "../../src/exceptions/git-failure.exception.ts";
import { HostKeyUnknownException } from "../../src/exceptions/host-key-unknown.exception.ts";
import { KeyRefusedException } from "../../src/exceptions/key-refused.exception.ts";
import { NothingToPushException } from "../../src/exceptions/nothing-to-push.exception.ts";
import { PushBehindException } from "../../src/exceptions/push-behind.exception.ts";
import { PushDetachedException } from "../../src/exceptions/push-detached.exception.ts";
import { PushNoRemoteException } from "../../src/exceptions/push-no-remote.exception.ts";
import { PushRejectedException } from "../../src/exceptions/push-rejected.exception.ts";
import { UpstreamNotSetException } from "../../src/exceptions/upstream-not-set.exception.ts";
import { ProgramResult } from "../../src/models/program-result.ts";
import type { ProgramRun } from "../../src/models/program-run.ts";
import type { RepositoryFolders } from "../../src/models/repository-folders.ts";
import { GitVersionReader } from "../../src/services/git-version.reader.ts";
import { HooksReader } from "../../src/services/hooks.reader.ts";
import { PushWriter } from "../../src/services/push.writer.ts";
import { RepositoryReader } from "../../src/services/repository.reader.ts";
import { SessionBranches } from "../../src/services/session-branches.ts";
import { StatusReader } from "../../src/services/status.reader.ts";
import { CleanUps } from "../fixtures/clean-ups.fixture.ts";
import { DesktopFixture } from "../fixtures/desktop.fixture.ts";
import { FakeAnswerer } from "../fixtures/fake-answerer.fixture.ts";
import { RepositoryFixture } from "../fixtures/repository.fixture.ts";
import { ScriptedRunnerFixture } from "../fixtures/scripted-runner.fixture.ts";

class PausingPushRunner extends ScriptedRunnerFixture {
  public beforePush: () => Promise<void> = () => Promise.resolve();

  public override async runAsync(run: ProgramRun): Promise<ProgramResult> {
    if (run.arguments[0] === "push")
      await this.beforePush();
    return await super.runAsync(run);
  }
}

describe("PushWriter", () => {
  const call = { session: "session-1", requestPermissionAsync: () => Promise.reject(new Error("never raised here")), markSending: () => undefined };
  const once = [PermissionOption.AllowOnce, PermissionOption.Deny];
  const always = [PermissionOption.AllowOnce, PermissionOption.AllowAlways, PermissionOption.Deny];
  let template: RepositoryFixture;
  let repository: RepositoryFixture;
  const cleanUps: CleanUps = new CleanUps();
  let supervisor: DesktopFixture;
  let runner: PausingPushRunner;
  let repositories: RepositoryReader;
  let statuses: StatusReader;
  let branches: SessionBranches;
  let hooks: HooksReader;
  let remote: string;

  beforeAll(async () => {
    template = await RepositoryFixture.createAsync();
  });

  afterAll(async () => {
    await template.disposeAsync();
  });

  beforeEach(async () => {
    repository = await RepositoryFixture.createAsync(template);
    cleanUps.add(() => repository.disposeAsync());
    remote = path.join(repository.root, "remote.git");
    await repository.runGitAsync(["clone", "--quiet", "--bare", repository.folder, remote]);
    await repository.runGitAsync(["remote", "add", "origin", remote]);
    await repository.runGitAsync(["fetch", "--quiet", "origin"]);
    await repository.runGitAsync(["branch", "--quiet", "--set-upstream-to=origin/main"]);
    await repository.runGitAsync(["remote", "set-head", "origin", "main"]);
    supervisor = await DesktopFixture.createAsync(repository.supervisorEnvironment());
    cleanUps.add(() => supervisor.disposeAsync());
    runner = new PausingPushRunner(supervisor.context);
    repositories = new RepositoryReader(runner, new GitVersionReader(runner));
    statuses = new StatusReader(runner);
    branches = new SessionBranches();
    hooks = new HooksReader(runner);
  });

  afterEach(async () => {
    await cleanUps.runAsync();
  });

  const readAsync = async (folder: string = repository.folder): Promise<[RepositoryFolders, GitStatus]> => {
    const folders = await repositories.readAsync(folder);
    return [folders, await statuses.readAsync(folders)];
  };
  const commitAsync = async (subject: string): Promise<string> => {
    await repository.runGitAsync(["commit", "--quiet", "--allow-empty", "-m", subject]);
    return (await repository.runGitAsync(["rev-parse", "--short", "HEAD"])).trim();
  };
  const remoteHeadAsync = async (branch: string): Promise<string> => (await repository.runGitAsync(["-C", remote, "rev-parse", branch])).trim();
  const hookAsync = async (name: string): Promise<void> => {
    const file = path.join(repository.gitFolder, "hooks", name);
    await writeFile(file, "#!/bin/sh\nexit 0\n");
    await chmod(file, 0o755);
  };
  const failsWith = (type: abstract new (...args: never[]) => GitFailureException, code: FailureCode, gitCode: GitCode | null, message?: string) => (error: unknown): boolean =>
    error instanceof type && error.code === code && error.gitCode === gitCode && (message === undefined || error.message === message);

  test("refuses a detached HEAD, a branch with no remote or no commit, nothing to push, and an upstream ahead of the branch", async () => {
    const write = new PushWriter(runner, hooks, branches);
    const [, status] = await readAsync();
    const variant = (changed: Partial<Pick<GitStatus, "branch" | "head" | "upstream" | "remote">>): GitStatus => {
      const next = { ...status, ...changed };
      return new GitStatus(next.branch, next.head, next.upstream, next.entries, next.truncated, next.fingerprint, next.operation, next.remote);
    };
    const upstream = (ahead: number, behind: number, gone: boolean): GitStatus => variant({ upstream: new StatusUpstream("origin/main", ahead, behind, gone) });

    assert.throws(() => write.refuse(variant({ branch: null })), failsWith(PushDetachedException, FailureCode.Refused, null, "HEAD is detached, so there's no branch to push. Switch to a branch first."));
    assert.throws(() => write.refuse(variant({ remote: null })), failsWith(PushNoRemoteException, FailureCode.Refused, null));
    assert.throws(() => write.refuse(variant({ head: null })), failsWith(NothingToPushException, FailureCode.Refused, null, "The branch has no commits that its upstream doesn't have."));
    assert.throws(() => write.refuse(status), failsWith(NothingToPushException, FailureCode.Refused, null, "The branch has no commits that its upstream doesn't have."));
    assert.throws(() => write.refuse(upstream(1, 1, false)), failsWith(PushBehindException, FailureCode.Git, GitCode.PushRejected));
    assert.doesNotThrow(() => write.refuse(upstream(1, 0, false)));
    assert.doesNotThrow(() => write.refuse(upstream(0, 0, true)));
    assert.doesNotThrow(() => write.refuse(variant({ upstream: null })));
    assert.doesNotThrow(() => write.refuse(variant({ upstream: new StatusUpstream("main", 0, 0, false) })));
  });

  test("publishes a branch whose upstream is a local branch under its own name, with the commits the remote has on no branch", async () => {
    await repository.runGitAsync(["switch", "--quiet", "--create", "tracker", "--track", "main"]);
    const own = await commitAsync("Own");
    const [folders, status] = await readAsync();
    const write = new PushWriter(runner, hooks, branches);

    assert.doesNotThrow(() => write.refuse(status));
    const asked = await write.requestAsync(folders, status, call);
    assert.equal(asked?.title, "Push 1 commit to origin/tracker");
    assert.deepEqual(asked?.details.map(t => t.value).slice(1), ["tracker", `${own} Own`, "None"]);
  });

  test("asks an agent's push to the default branch at high risk with the push URL and the commits, never offering Always allow", async () => {
    const first = await commitAsync("First");
    const second = await commitAsync("Second");
    const [folders, status] = await readAsync();

    assert.deepEqual(await new PushWriter(runner, hooks, branches).requestAsync(folders, status, call), {
      action: "git.push",
      subject: JSON.stringify([folders.top, "origin", "main"]),
      title: "Push 2 commits to origin/main",
      details: [
        { label: "Remote", kind: PermissionDetailKind.Text, value: `origin ${remote}` },
        { label: "Branch", kind: PermissionDetailKind.Text, value: "main, the repository's default branch" },
        { label: "Commits", kind: PermissionDetailKind.Code, value: `${second} Second\n${first} First` },
        { label: "Hooks that will run", kind: PermissionDetailKind.Text, value: "None" },
        { label: "Note", kind: PermissionDetailKind.Text, value: "The default branch is never allowed always." }
      ],
      risk: ToolRisk.High,
      options: once
    });
  });

  test("offers Always allow, at medium risk with its words, only for a branch the session made, publishing it under its own name", async () => {
    await repository.runGitAsync(["switch", "--quiet", "--create", "feature"]);
    const only = await commitAsync("Only");
    const [folders, status] = await readAsync();
    const write = new PushWriter(runner, hooks, branches);

    const theirs = await write.requestAsync(folders, status, call);
    assert.equal(theirs?.title, "Push 1 commit to origin/feature");
    assert.deepEqual(theirs?.details.map(t => t.value).slice(1), ["feature", `${only} Only`, "None"]);
    assert.deepEqual(theirs?.options, once);
    assert.equal(theirs?.risk, ToolRisk.High);
    assert.equal(theirs?.labels, undefined);
    assert.equal(theirs?.subject, JSON.stringify([folders.top, "origin", "feature"]));

    branches.add("session-1", folders.top, "feature");
    const made = await write.requestAsync(folders, status, call);
    assert.deepEqual(made?.details.map(t => t.value).slice(1), ["feature (made by this teammate)", `${only} Only`, "None"]);
    assert.deepEqual(made?.options, always);
    assert.equal(made?.risk, ToolRisk.Medium);
    assert.deepEqual(made?.labels, { [PermissionOption.AllowAlways]: "Always allow in this repository" });
    assert.equal(made?.subject, JSON.stringify([folders.top, "origin", "feature", "session-1"]));
    const other = await write.requestAsync(folders, status, { ...call, session: "session-2" });
    assert.deepEqual([other?.options, other?.risk, other?.labels], [once, ToolRisk.High, undefined]);

    await repository.runGitAsync(["remote", "set-head", "origin", "--delete"]);
    const unknown = await write.requestAsync(folders, status, call);
    assert.deepEqual([unknown?.options, unknown?.risk, unknown?.labels], [once, ToolRisk.High, undefined]);
    await repository.runGitAsync(["update-ref", "refs/remotes/elsewhere/feature", "HEAD"]);
    await repository.runGitAsync(["symbolic-ref", "refs/remotes/origin/HEAD", "refs/remotes/elsewhere/feature"]);
    const elsewhere = await write.requestAsync(folders, status, call);
    assert.deepEqual([elsewhere?.options, elsewhere?.risk, elsewhere?.labels], [once, ToolRisk.High, undefined]);
  });

  test("offers Always allow for no branch the session made that goes to a remote branch of another name, and names the hooks that will run", async () => {
    await repository.runGitAsync(["push", "--quiet", "origin", "main:shared"]);
    await repository.runGitAsync(["fetch", "--quiet", "origin"]);
    await repository.runGitAsync(["switch", "--quiet", "--create", "mine", "--track", "origin/shared"]);
    await commitAsync("Mine");
    await hookAsync("pre-push");
    const [folders, status] = await readAsync();
    branches.add("session-1", folders.top, "mine");

    const asked = await new PushWriter(runner, hooks, branches).requestAsync(folders, status, call);

    assert.deepEqual(asked?.details.map(t => t.value).slice(1, 2), ["mine to shared"]);
    assert.deepEqual(asked?.details[3], { label: "Hooks that will run", kind: PermissionDetailKind.Text, value: "pre-push" });
    assert.deepEqual([asked?.options, asked?.risk, asked?.labels], [once, ToolRisk.High, undefined]);
  });

  test("remembers an agent's Always allow for the session that made the branch only, so another session's push asks again", async () => {
    await repository.runGitAsync(["switch", "--quiet", "--create", "feature"]);
    await commitAsync("Only");
    const [folders, status] = await readAsync();
    branches.add("session-1", folders.top, "feature");
    branches.add("session-2", folders.top, "feature");
    const write = new PushWriter(runner, hooks, branches);
    const shell = path.join(repository.root, "shell");
    await mkdir(shell);
    const lock = OwnershipLock.acquire(new DataDirectory(shell));
    const database = await ShellDatabase.openAsync(lock, ShellMigrations.all);
    try {
      const log = new FakeModuleLog();
      const center = new PermissionCenter("app");
      center.open(new RememberedPermissionStore(database));
      const answerer = new FakeAnswerer();
      answerer.answerNext(PermissionDecision.AllowedAlways, PermissionDecision.AllowedOnce);
      center.registerAnswerer("app", answerer, log);
      const descriptor = new ToolDescriptor({
        name: "git_push",
        description: "Pushes the current branch.",
        inputSchema: { type: "object" },
        risk: { default: ToolRisk.High, maximum: ToolRisk.High },
        deadline: { default: 1_000, maximum: 1_000 },
        isResumable: true
      }, ["git_push"]);
      const askAsync = async (session: string): Promise<string> => {
        const request = await write.requestAsync(folders, status, { ...call, session });
        assert.ok(request);
        const outcome = await center.requestAsync("git", descriptor, log, new ToolSession(session, "conversation-1", {}, new ToolRegistry()), request,
          new AbortController().signal);
        return `${outcome.decision}|${String(outcome.isRemembered)}|${answerer.requests.length}`;
      };

      assert.equal(await askAsync("session-1"), `${PermissionDecision.AllowedAlways}|false|1`);
      assert.equal(await askAsync("session-1"), `${PermissionDecision.AllowedAlways}|true|1`);
      assert.equal(await askAsync("session-2"), `${PermissionDecision.AllowedOnce}|false|2`);
    } finally {
      database.close();
      lock.release();
    }
  });

  test("names the upstream's branch when it differs, strips a URL's name and password, and counts the commits past the hundred it shows", async () => {
    const base = (await repository.runGitAsync(["rev-parse", "HEAD"])).trim();
    const commits = Array.from({ length: 150 }, (_, index) => [
      "commit refs/heads/local",
      "committer Noldova Test <test@example.invalid> 1767225600 +0000",
      `data ${String(`Local ${index + 1}`.length)}`,
      `Local ${index + 1}`,
      ...index === 0 ? [`from ${base}`] : [],
      ""
    ].join("\n"));
    await repository.runGitAsync(["fast-import", "--quiet"], commits.join(""));
    await repository.runGitAsync(["switch", "--quiet", "local"]);
    await repository.runGitAsync(["branch", "--quiet", "--set-upstream-to=origin/main"]);
    await repository.runGitAsync(["remote", "set-url", "--push", "origin", "https://name:token@example.invalid/repo.git"]);
    const [folders, status] = await readAsync();

    const asked = await new PushWriter(runner, hooks, branches).requestAsync(folders, status, call);

    assert.equal(asked?.title, "Push 150 commits to origin/main");
    assert.deepEqual(asked?.details.map(t => t.value).slice(0, 2), ["origin https://example.invalid/repo.git", "local to main, the repository's default branch"]);
    const shown = (asked?.details[2]?.value ?? "").split("\n");
    assert.deepEqual([shown.length, shown.at(-1)], [101, "…and 50 more commits"]);
    assert.deepEqual(shown.slice(0, 100).map(t => t.replace(/^[0-9a-f]+ /v, "")), Array.from({ length: 100 }, (_, index) => `Local ${150 - index}`));
  });

  test("fails with git's output when git can't read what the request shows", async () => {
    await commitAsync("Ahead");
    const [folders, status] = await readAsync();
    await repository.runGitAsync(["config", "--remove-section", "remote.origin"]);

    await assert.rejects(new PushWriter(runner, hooks, branches).requestAsync(folders, status, call),
      failsWith(GitFailedException, FailureCode.Unavailable, null, "git remote get-url failed; its output comes with the failure as untrusted text."));
  });

  test("fails with git's output when the remote's default branch can't be read for any reason but an unset one", async () => {
    await commitAsync("Ahead");
    const [folders, status] = await readAsync();
    runner.failing = "symbolic-ref";
    runner.failingCode = 128;

    await assert.rejects(new PushWriter(runner, hooks, branches).requestAsync(folders, status, call),
      failsWith(GitFailedException, FailureCode.Unavailable, null, "git symbolic-ref failed; its output comes with the failure as untrusted text."));
  });

  test("pushes the branch to its upstream, and publishes a new branch with its upstream set", async () => {
    await commitAsync("Ahead");
    const write = new PushWriter(runner, hooks, branches);
    await write.runAsync(...await readAsync());
    assert.equal(await remoteHeadAsync("main"), (await repository.runGitAsync(["rev-parse", "HEAD"])).trim());

    await repository.runGitAsync(["switch", "--quiet", "--create", "feature"]);
    await commitAsync("Feature");
    await write.runAsync(...await readAsync());
    assert.equal(await remoteHeadAsync("feature"), (await repository.runGitAsync(["rev-parse", "HEAD"])).trim());
    assert.equal((await repository.runGitAsync(["rev-parse", "--abbrev-ref", "feature@{upstream}"])).trim(), "origin/feature");
  });

  test("pushes the commit the status read, never one that reached the branch after it", async () => {
    await commitAsync("Shown");
    const [folders, status] = await readAsync();
    runner.beforePush = async () => {
      await commitAsync("Later");
    };

    await new PushWriter(runner, hooks, branches).runAsync(folders, status);

    assert.equal(await remoteHeadAsync("main"), status.head);
    assert.notEqual((await repository.runGitAsync(["rev-parse", "HEAD"])).trim(), status.head);
  });

  test("fails with git's output when the push went through but git can't set the new branch's upstream", async () => {
    await repository.runGitAsync(["switch", "--quiet", "--create", "feature"]);
    await commitAsync("Feature");
    const [folders, status] = await readAsync();
    await writeFile(path.join(repository.gitFolder, "config.lock"), "");

    await assert.rejects(new PushWriter(runner, hooks, branches).runAsync(folders, status), failsWith(UpstreamNotSetException, FailureCode.Unavailable, null,
      "The push went through, but git couldn't set the remote branch as the branch's upstream; its output comes with the failure as untrusted text."));
    assert.equal(await remoteHeadAsync("feature"), status.head);
  });

  test("fails as rejected when the remote has commits the branch doesn't", async () => {
    const elsewhere = (await repository.runGitAsync(["commit-tree", "HEAD^{tree}", "-p", "HEAD", "-m", "Elsewhere"])).trim();
    await repository.runGitAsync(["push", "--quiet", "origin", `${elsewhere}:refs/heads/main`]);
    await commitAsync("Ahead");

    await assert.rejects(new PushWriter(runner, hooks, branches).runAsync(...await readAsync()), failsWith(PushRejectedException, FailureCode.Git, GitCode.PushRejected));
    assert.equal(await remoteHeadAsync("main"), elsewhere);
  });

  test("tells each other refusal from the remote's real answers: its hook's, an unknown host key, a refused SSH key, a sign-in it can't give, and no remote there", async () => {
    await commitAsync("Ahead");
    const write = new PushWriter(runner, hooks, branches);
    const pushAsync = async (): Promise<void> => await write.runAsync(...await readAsync());
    const hook = path.join(remote, "hooks", "pre-receive");
    await writeFile(hook, "#!/bin/sh\nexit 1\n");
    await chmod(hook, 0o755);
    const server = createServer((_request, response) => response.writeHead(401, { "WWW-Authenticate": "Basic realm=\"repo\"" }).end());
    await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve));
    onTestFinished(() => new Promise<void>(resolve => server.close(() => resolve())));
    const address = server.address();
    assert.ok(address !== null && typeof address === "object");
    const sshAsync = async (errors: string): Promise<void> => {
      await repository.runGitAsync(["config", "core.sshCommand", `echo '${errors}' >&2; exit 255; :`]);
    };

    await assert.rejects(pushAsync(), failsWith(PushRejectedException, FailureCode.Git, GitCode.PushRejected));
    await repository.runGitAsync(["remote", "set-url", "origin", "ssh://git@example.invalid/team/repo.git"]);
    await sshAsync("Host key verification failed.");
    await assert.rejects(pushAsync(), failsWith(HostKeyUnknownException, FailureCode.Git, GitCode.HostKeyUnknown));
    await sshAsync("git@example.invalid: Permission denied (publickey).");
    await assert.rejects(pushAsync(), failsWith(KeyRefusedException, FailureCode.Git, GitCode.KeyRefused));
    await repository.runGitAsync(["remote", "set-url", "origin", `http://127.0.0.1:${String(address.port)}/repo.git`]);
    await assert.rejects(pushAsync(), failsWith(CredentialsNeededException, FailureCode.Git, GitCode.CredentialsNeeded));
    await repository.runGitAsync(["remote", "set-url", "origin", path.join(repository.root, "missing.git")]);
    await assert.rejects(pushAsync(), failsWith(GitFailedException, FailureCode.Unavailable, null));
    assert.notEqual(await remoteHeadAsync("main"), (await repository.runGitAsync(["rev-parse", "HEAD"])).trim());
  });

  test("never forces, and sends no tags or submodules, only the branch's own ref", async () => {
    await commitAsync("Ahead");
    await repository.runGitAsync(["tag", "v1"]);
    await repository.runGitAsync(["config", "push.followTags", "true"]);

    await new PushWriter(runner, hooks, branches).runAsync(...await readAsync());

    assert.deepEqual(supervisor.requests.map(t => t.arguments.join(" ")).filter(t => t.includes(" push ")), [
      `-c core.fsmonitor=false push --porcelain --no-follow-tags --recurse-submodules=no -- origin ${(await repository.runGitAsync(["rev-parse", "HEAD"])).trim()}:refs/heads/main`
    ]);
    assert.equal(await repository.runGitAsync(["-C", remote, "tag", "--list"]), "");
  });
});
