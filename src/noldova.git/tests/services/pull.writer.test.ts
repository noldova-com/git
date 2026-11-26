/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */
import assert from "node:assert/strict";
import { chmod, mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import { createServer } from "node:http";
import path from "node:path";

import { afterAll, afterEach, beforeAll, beforeEach, describe, onTestFinished, test } from "vitest";

import { PermissionDetailKind, PermissionOption, ToolRisk } from "@noldova/desktop.runtime";
import { FailureCode, GitCode, UntrustedSource } from "@noldova/git.protocol";

import { CredentialsNeededException } from "../../src/exceptions/credentials-needed.exception.ts";
import { GitFailedException } from "../../src/exceptions/git-failed.exception.ts";
import type { GitFailureException } from "../../src/exceptions/git-failure.exception.ts";
import { GitMissingException } from "../../src/exceptions/git-missing.exception.ts";
import { HostKeyUnknownException } from "../../src/exceptions/host-key-unknown.exception.ts";
import { KeyRefusedException } from "../../src/exceptions/key-refused.exception.ts";
import { ProgramTimedOutException } from "../../src/exceptions/program-timed-out.exception.ts";
import { PullChangesInTheWayException } from "../../src/exceptions/pull-changes-in-the-way.exception.ts";
import { PullConflictsException } from "../../src/exceptions/pull-conflicts.exception.ts";
import { PullDetachedException } from "../../src/exceptions/pull-detached.exception.ts";
import { PullDivergedException } from "../../src/exceptions/pull-diverged.exception.ts";
import { PullNoUpstreamException } from "../../src/exceptions/pull-no-upstream.exception.ts";
import { StatusMovedException } from "../../src/exceptions/status-moved.exception.ts";
import { UnsafeRepositoryException } from "../../src/exceptions/unsafe-repository.exception.ts";
import { WriteOutcomeUnknownException } from "../../src/exceptions/write-outcome-unknown.exception.ts";
import type { ProgramResult } from "../../src/models/program-result.ts";
import type { ProgramRun } from "../../src/models/program-run.ts";
import { RepositoryFolders } from "../../src/models/repository-folders.ts";
import { Resources } from "../../src/resources.ts";
import { CheckoutRisksReader } from "../../src/services/checkout-risks.reader.ts";
import { FilterOptionsReader } from "../../src/services/filter-options.reader.ts";
import { HooksReader } from "../../src/services/hooks.reader.ts";
import { Journal } from "../../src/services/journal.ts";
import { ProgramRunner } from "../../src/services/program-runner.ts";
import { PullWriter } from "../../src/services/pull.writer.ts";
import { RefSnapshotReader } from "../../src/services/ref-snapshot.reader.ts";
import { StatusReader } from "../../src/services/status.reader.ts";
import { WriteRunner } from "../../src/services/write.runner.ts";
import { CleanUps } from "../fixtures/clean-ups.fixture.ts";
import { DesktopFixture } from "../fixtures/desktop.fixture.ts";
import { RepositoryFixture } from "../fixtures/repository.fixture.ts";
import { ScriptedRunnerFixture } from "../fixtures/scripted-runner.fixture.ts";

class ThrowingRunner extends ProgramRunner {
  public error: unknown = null;

  public override async runAsync(run: ProgramRun): Promise<ProgramResult> {
    if (run.arguments[0] === "pull")
      throw this.error;
    return await super.runAsync(run);
  }
}

describe("PullWriter", () => {
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
  const headAsync = async (): Promise<string> => (await repository.runGitAsync(["rev-parse", "HEAD"])).trim();
  const commitRemotelyAsync = async (file: string, content: string): Promise<string> => {
    await repository.writeAsync(file, content);
    await repository.runGitAsync(["add", file]);
    await repository.runGitAsync(["commit", "--quiet", "-m", "Remote"]);
    await repository.runGitAsync(["push", "--quiet", "origin", "main"]);
    const commit = await headAsync();
    await repository.runGitAsync(["reset", "--quiet", "--hard", "HEAD~1"]);
    return commit;
  };
  const readTextAsync = async (file: string): Promise<string> => await readFile(path.join(repository.folder, file), "utf8");
  const commitLocallyAsync = async (): Promise<void> => {
    await repository.runGitAsync(["commit", "--quiet", "--allow-empty", "-m", "Local"]);
  };
  const fingerprintAsync = async (): Promise<string> => (await new StatusReader(runner).readAsync(folders)).fingerprint;
  const pullAsync = async (through: ProgramRunner = runner, signal?: AbortSignal, basedOn?: string): Promise<void> =>
    await new WriteRunner(new StatusReader(through), new RefSnapshotReader(through), new Journal(), () => undefined, () => undefined).runAsync(folders, basedOn ?? await fingerprintAsync(), new PullWriter(through, new CheckoutRisksReader(new HooksReader(through), new FilterOptionsReader(through))), null, signal);
  const refusal = (type: abstract new (...args: never[]) => GitFailureException, code: FailureCode, gitCode: GitCode | null, message: string): ((error: unknown) => boolean) => (error: unknown): boolean => {
    assert.ok(error instanceof type);
    assert.deepEqual([error.code, error.gitCode, error.message], [code, gitCode, message]);
    return true;
  };

  test("asks an agent's pull at medium risk with the upstream, the branch and the hooks that will run, and refuses before asking what can't fast-forward", async () => {
    await trackAsync();
    const write = new PullWriter(runner, new CheckoutRisksReader(new HooksReader(runner), new FilterOptionsReader(runner)));
    const call = { session: "session-1", requestPermissionAsync: () => Promise.reject(new Error("never raised here")), markSending: () => undefined };
    const status = await new StatusReader(runner).readAsync(folders);
    assert.deepEqual(await write.requestAsync(folders, status, call), {
      action: "git.pull",
      subject: folders.top,
      title: "Pull origin/main into main",
      details: [{ label: "Hooks that will run", kind: PermissionDetailKind.Text, value: "None" }],
      risk: ToolRisk.Medium,
      options: [PermissionOption.AllowOnce, PermissionOption.AllowAlways, PermissionOption.Deny],
      labels: { [PermissionOption.AllowAlways]: "Always allow in this repository" }
    });
    const hook = path.join(repository.gitFolder, "hooks", "post-merge");
    await writeFile(hook, "#!/bin/sh\nexit 0\n");
    await chmod(hook, 0o755);
    assert.equal((await write.requestAsync(folders, status, call))?.details[0]?.value, "post-merge");

    await repository.runGitAsync(["switch", "--quiet", "--detach"]);
    const detached = await new StatusReader(runner).readAsync(folders);
    await assert.rejects(write.requestAsync(folders, detached, call), refusal(PullDetachedException, FailureCode.Git, GitCode.NoUpstream, "HEAD isn't on a branch, so there's nothing to pull into."));
  });

  const addLibraryAsync = async (): Promise<string> => {
    const source = path.join(repository.root, "library");
    await repository.runGitAsync(["init", "--quiet", source]);
    await writeFile(path.join(source, "library.txt"), "a");
    await repository.runGitAsync(["-C", source, "add", "library.txt"]);
    await repository.runGitAsync(["-C", source, "commit", "--quiet", "-m", "library"]);
    await repository.runGitAsync(["-c", "protocol.file.allow=always", "submodule", "--quiet", "add", source, "library"]);
    await repository.runGitAsync(["commit", "--quiet", "-m", "Add the library"]);
    return path.join(repository.folder, "library");
  };
  const gitFolderOf = async (folder: string): Promise<string> => (await repository.runGitAsync(["-C", folder, "rev-parse", "--absolute-git-dir"])).trim();
  const libraryHookAsync = async (library: string, name: string, script: string): Promise<void> => {
    const hooksFolder = path.join(await gitFolderOf(library), "hooks");
    await mkdir(hooksFolder, { recursive: true });
    await writeFile(path.join(hooksFolder, name), script);
    await chmod(path.join(hooksFolder, name), 0o755);
  };
  const riskCall = { session: "session-1", requestPermissionAsync: () => Promise.reject(new Error("never raised here")), markSending: () => undefined };
  const requestDetailsAsync = async (): Promise<(string | undefined)[] | undefined> =>
    (await new PullWriter(runner, new CheckoutRisksReader(new HooksReader(runner), new FilterOptionsReader(runner)))
      .requestAsync(folders, await new StatusReader(runner).readAsync(folders), riskCall))?.details.map(t => t.value);

  test("names each checked-out submodule's checkout hooks, never the pull's own, and filters, with its path, once submodule.recurse is set", async () => {
    const library = await addLibraryAsync();
    await trackAsync();
    await repository.runGitAsync(["-C", library, "config", "filter.shallow.process", "shallow-filter"]);
    await libraryHookAsync(library, "post-merge", "#!/bin/sh");
    await libraryHookAsync(library, "post-checkout", "#!/bin/sh");
    await libraryHookAsync(library, "post-index-change", "#!/bin/sh");
    const alone = await requestDetailsAsync();
    await repository.runGitAsync(["config", "submodule.recurse", "true"]);

    const recursing = await requestDetailsAsync();

    assert.deepEqual([alone, recursing], [["None"], ["post-checkout (library), post-index-change (library)", "shallow"]]);
  });

  test("names no hook and no filter for a checked-out submodule that has neither, with submodule.recurse set", async () => {
    await addLibraryAsync();
    await trackAsync();
    await repository.runGitAsync(["config", "submodule.recurse", "true"]);

    assert.deepEqual(await requestDetailsAsync(), ["None"]);
  });

  test("runs in a submodule exactly the hooks that the request names when a recursive pull moves it", async () => {
    const library = await addLibraryAsync();
    await trackAsync();
    const source = path.join(repository.root, "library");
    const first = (await repository.runGitAsync(["-C", library, "rev-parse", "HEAD"])).trim();
    await writeFile(path.join(source, "library.txt"), "b");
    await repository.runGitAsync(["-C", source, "commit", "--quiet", "-am", "Change the library"]);
    await repository.runGitAsync(["-C", library, "-c", "protocol.file.allow=always", "fetch", "--quiet"]);
    const second = (await repository.runGitAsync(["-C", source, "rev-parse", "HEAD"])).trim();
    await repository.runGitAsync(["-C", library, "checkout", "--quiet", second]);
    await repository.runGitAsync(["add", "library"]);
    await repository.runGitAsync(["commit", "--quiet", "-m", "Move the library"]);
    await repository.runGitAsync(["push", "--quiet", "origin", "main"]);
    await repository.runGitAsync(["reset", "--quiet", "--hard", "HEAD~1"]);
    await repository.runGitAsync(["-C", library, "checkout", "--quiet", first]);
    await repository.runGitAsync(["-C", library, "config", "protocol.file.allow", "always"]);
    const candidates = ["post-checkout", "post-merge", "post-index-change", "reference-transaction", "post-rewrite"];
    for (const name of candidates)
      await libraryHookAsync(library, name, `#!/bin/sh\necho ${name} >> "$(git rev-parse --absolute-git-dir)/fired"\n`);
    await repository.runGitAsync(["config", "submodule.recurse", "true"]);
    const named = (await requestDetailsAsync())?.[0] ?? "";

    await pullAsync();

    const fired = [...new Set((await readFile(path.join(await gitFolderOf(library), "fired"), "utf8")).split(/\s+/v).filter(t => t.length > 0))];
    assert.equal((await repository.runGitAsync(["-C", library, "rev-parse", "HEAD"])).trim(), second);
    assert.deepEqual([fired.sort(), named],
      [["post-checkout", "post-index-change", "reference-transaction"], "post-checkout (library), post-index-change (library), reference-transaction (library)"]);
  });

  test("names the smudge or process filters the repository's own configuration names in an agent's pull, since its checkout runs them", async () => {
    await trackAsync();
    const write = new PullWriter(runner, new CheckoutRisksReader(new HooksReader(runner), new FilterOptionsReader(runner)));
    const call = { session: "session-1", requestPermissionAsync: () => Promise.reject(new Error("never raised here")), markSending: () => undefined };
    await repository.runGitAsync(["config", "filter.crypt.clean", "crypt-filter"]);
    const without = (await write.requestAsync(folders, await new StatusReader(runner).readAsync(folders), call))?.details.length;
    await repository.runGitAsync(["config", "filter.smudged.smudge", "smudge-filter"]);
    await repository.runGitAsync(["config", "filter.lfs.process", "lfs-filter"]);

    const request = await write.requestAsync(folders, await new StatusReader(runner).readAsync(folders), call);

    assert.deepEqual([without, request?.risk, request?.details[1]], [1, ToolRisk.Medium,
      { label: "Filters that will run", kind: PermissionDetailKind.Text, value: "smudged, lfs" }]);
  });

  test("fast-forwards the branch to its upstream's newest commit, fetching it first", async () => {
    await trackAsync();
    const commit = await advanceRemoteAsync();

    await pullAsync();

    assert.equal(await headAsync(), commit);
    assert.ok(commands.some(t => t.startsWith("pull --ff-only --no-rebase --no-autostash")));
  });

  test("pulls past an uncommitted change to a file the pull doesn't touch, keeping the change", async () => {
    await trackAsync();
    const commit = await commitRemotelyAsync("b.txt", "remote\n");
    await repository.writeAsync("a.txt", "mine\n");

    await pullAsync();

    assert.equal(await headAsync(), commit);
    assert.deepEqual([await readTextAsync("a.txt"), await readTextAsync("b.txt")], ["mine\n", "remote\n"]);
  });

  test("refuses a pull that would overwrite an uncommitted change as ChangesInTheWay, naming the file and leaving the tree as it was", async () => {
    await trackAsync();
    await commitRemotelyAsync("a.txt", "remote\n");
    await repository.writeAsync("a.txt", "mine\n");
    const before = await headAsync();

    await assert.rejects(pullAsync(), (error: unknown): boolean => {
      assert.ok(error instanceof PullChangesInTheWayException);
      assert.deepEqual(error.paths, ["a.txt"]);
      assert.deepEqual([error.code, error.gitCode, error.message, error.output?.source], [FailureCode.Git, GitCode.ChangesInTheWay,
        "Pulling would overwrite your changes to a.txt, so git didn't pull. Commit or stash them first.", UntrustedSource.Repository]);
      return true;
    });
    assert.equal(await headAsync(), before);
    assert.equal(await readTextAsync("a.txt"), "mine\n");
  });

  test("runs the repository's post-merge hook, since a pull is the person's own git pull", async () => {
    await trackAsync();
    await advanceRemoteAsync();
    const hook = path.join(repository.gitFolder, "hooks", "post-merge");
    await writeFile(hook, "#!/bin/sh\necho ran > post-merge-ran\n");
    await chmod(hook, 0o755);

    await pullAsync();

    assert.equal(await readTextAsync("post-merge-ran"), "ran\n");
  });

  test("refuses a status that has moved since the caller read it, without running git pull", async () => {
    await trackAsync();
    await advanceRemoteAsync();
    const before = await headAsync();

    await assert.rejects(pullAsync(runner, undefined, "old"),
      refusal(StatusMovedException, FailureCode.Stale, null, "The repository changed since the status the write is based on, so nothing ran. Read the status again."));
    assert.equal(await headAsync(), before);
    assert.ok(!commands.some(t => t.startsWith("pull")));
  });

  test("refuses a branch without an upstream, one whose upstream is gone, and a detached HEAD, without running git pull", async () => {
    const noUpstream = "This branch has no upstream to pull from, or its upstream is gone. Publish it first.";

    await assert.rejects(pullAsync(), refusal(PullNoUpstreamException, FailureCode.Git, GitCode.NoUpstream, noUpstream));
    await trackAsync();
    await repository.runGitAsync(["update-ref", "-d", "refs/remotes/origin/main"]);
    await assert.rejects(pullAsync(), refusal(PullNoUpstreamException, FailureCode.Git, GitCode.NoUpstream, noUpstream));
    await repository.runGitAsync(["checkout", "--quiet", "--detach"]);
    await assert.rejects(pullAsync(), refusal(PullDetachedException, FailureCode.Git, GitCode.NoUpstream, "HEAD isn't on a branch, so there's nothing to pull into."));
    assert.ok(!commands.some(t => t.startsWith("pull")));
  });

  test("refuses a merge in progress, and conflicts left after it, without running git pull", async () => {
    const conflicts = "Finish the merge or other operation in progress, and resolve and stage its conflicts, before pulling.";
    await trackAsync();
    await repository.runGitAsync(["checkout", "--quiet", "-b", "other"]);
    await repository.writeAsync("a.txt", "other\n");
    await repository.runGitAsync(["commit", "--quiet", "-am", "Other"]);
    await repository.runGitAsync(["checkout", "--quiet", "main"]);
    await repository.writeAsync("a.txt", "main\n");
    await repository.runGitAsync(["commit", "--quiet", "-am", "Main"]);
    await assert.rejects(repository.runGitAsync(["merge", "--quiet", "other"]));

    await assert.rejects(pullAsync(), refusal(PullConflictsException, FailureCode.Git, GitCode.Conflict, conflicts));
    await unlink(path.join(repository.gitFolder, "MERGE_HEAD"));
    await assert.rejects(pullAsync(), refusal(PullConflictsException, FailureCode.Git, GitCode.Conflict, conflicts));
    assert.ok(!commands.some(t => t.startsWith("pull")));
  });

  test("refuses a branch that has diverged from its upstream as last fetched, without running git pull", async () => {
    await trackAsync();
    await advanceRemoteAsync();
    await repository.runGitAsync(["fetch", "--quiet", "origin"]);
    await commitLocallyAsync();

    await assert.rejects(pullAsync(), refusal(PullDivergedException, FailureCode.Git, GitCode.Diverged,
      "This branch and its upstream each have commits the other doesn't, so a pull can't fast-forward it. Merge or rebase it: in History, drag the upstream onto the branch."));
    assert.ok(!commands.some(t => t.startsWith("pull")));
  });

  test("names a divergence that git pull's own fetch finds, leaving the branch where it was", async () => {
    await trackAsync();
    await advanceRemoteAsync();
    await commitLocallyAsync();
    const before = await headAsync();

    await assert.rejects(pullAsync(), refusal(PullDivergedException, FailureCode.Git, GitCode.Diverged,
      "This branch and its upstream each have commits the other doesn't, so a pull can't fast-forward it. Merge or rebase it: in History, drag the upstream onto the branch."));
    assert.equal(await headAsync(), before);
  });

  test("fails with git's output as untrusted text when git pull fails otherwise, such as on a remote it can't reach", async () => {
    await trackAsync();
    await commitLocallyAsync();
    await repository.runGitAsync(["remote", "set-url", "origin", path.join(repository.root, "missing.git")]);

    await assert.rejects(pullAsync(), (error: unknown): boolean => {
      assert.ok(error instanceof GitFailedException);
      assert.deepEqual([error.code, error.gitCode, error.message, error.output?.source],
        [FailureCode.Unavailable, null, "git pull failed; its output comes with the failure as untrusted text.", UntrustedSource.Repository]);
      assert.ok((error.output?.text ?? "").length > 0);
      return true;
    });
  });

  test("tells an unknown host key, a refused SSH key and a sign-in it can't give from the remote's real answers, as a push does", async () => {
    await trackAsync();
    await advanceRemoteAsync();
    const sshAsync = async (errors: string): Promise<void> => {
      await repository.runGitAsync(["config", "core.sshCommand", `echo '${errors}' >&2; exit 255; :`]);
    };
    const server = createServer((_request, response) => response.writeHead(401, { "WWW-Authenticate": "Basic realm=\"repo\"" }).end());
    await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve));
    onTestFinished(() => new Promise<void>(resolve => server.close(() => resolve())));
    const address = server.address();
    assert.ok(address !== null && typeof address === "object");

    await repository.runGitAsync(["remote", "set-url", "origin", "ssh://git@example.invalid/team/repo.git"]);
    await sshAsync("Host key verification failed.");
    await assert.rejects(pullAsync(), refusal(HostKeyUnknownException, FailureCode.Git, GitCode.HostKeyUnknown, Resources.pushHostKeyUnknown));
    await sshAsync("git@example.invalid: Permission denied (publickey).");
    await assert.rejects(pullAsync(), refusal(KeyRefusedException, FailureCode.Git, GitCode.KeyRefused, Resources.pushKeyRefused));
    await repository.runGitAsync(["remote", "set-url", "origin", `http://127.0.0.1:${String(address.port)}/repo.git`]);
    await assert.rejects(pullAsync(), refusal(CredentialsNeededException, FailureCode.Git, GitCode.CredentialsNeeded, Resources.pushCredentialsNeeded));
  });

  test("refuses a repository git calls unsafe, naming the folder git names, scripted since its ownership can change only between the repository read and the pull", async () => {
    await trackAsync();
    await advanceRemoteAsync();
    runner.failing = "pull --ff-only";
    runner.failingCode = 128;
    runner.failingErrors = "fatal: detected dubious ownership in repository at '/work/library'\n";

    await assert.rejects(pullAsync(), (error: unknown): boolean => {
      assert.ok(error instanceof UnsafeRepositoryException);
      assert.deepEqual([error.code, error.gitCode, error.folder, error.output?.text], [FailureCode.NotRepository, GitCode.UnsafeRepository, "/work/library", runner.failingErrors]);
      return true;
    });
  });

  test("names no divergence when the counts show the branch only behind or can't be read", async () => {
    const failed = refusal(GitFailedException, FailureCode.Unavailable, null, "git pull failed; its output comes with the failure as untrusted text.");
    await trackAsync();
    await advanceRemoteAsync();
    await repository.runGitAsync(["fetch", "--quiet", "origin"]);
    await repository.runGitAsync(["remote", "set-url", "origin", path.join(repository.root, "missing.git")]);

    await assert.rejects(pullAsync(), failed);
    runner.answering = ["rev-list", "unreadable\n"];
    await assert.rejects(pullAsync(), failed);
    runner.answering = null;
    runner.failing = "--left-right";
    await assert.rejects(pullAsync(), failed);
  });

  test("calls a pull stopped after it started of unknown outcome, and passes on any other failure to start it", async () => {
    await trackAsync();
    const throwing = new ThrowingRunner(supervisor.context);
    const unknown = refusal(WriteOutcomeUnknownException, FailureCode.Git, GitCode.OutcomeUnknown,
      "The write was cancelled or ran out of time after git started, so whether it happened is unknown. Read the status again before any retry.");
    const stopping = new AbortController();
    runner.starting = command => {
      if (command.startsWith("pull"))
        stopping.abort(new Error("stopped"));
    };

    await assert.rejects(pullAsync(runner, stopping.signal), unknown);
    throwing.error = new ProgramTimedOutException("git", 120_000);
    await assert.rejects(pullAsync(throwing), unknown);
    throwing.error = new GitMissingException("git", new Error("spawn git ENOENT"));
    await assert.rejects(pullAsync(throwing), refusal(GitMissingException, FailureCode.Git, GitCode.GitMissing, "git isn't found or can't be started."));
  });
});
