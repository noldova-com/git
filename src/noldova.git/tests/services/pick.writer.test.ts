/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */
import assert from "node:assert/strict";
import { access, chmod, writeFile } from "node:fs/promises";
import path from "node:path";

import { afterAll, afterEach, beforeAll, beforeEach, describe, test } from "vitest";

import { PermissionDetailKind, PermissionOption, ToolRisk } from "@noldova/desktop.runtime";
import { FailureCode, GitCode, GitNames, UntrustedSource } from "@noldova/git.protocol";

import { GitFailedException } from "../../src/exceptions/git-failed.exception.ts";
import type { GitFailureException } from "../../src/exceptions/git-failure.exception.ts";
import { PickDuringOperationException } from "../../src/exceptions/pick-during-operation.exception.ts";
import { PickEmptyException } from "../../src/exceptions/pick-empty.exception.ts";
import { PickStoppedException } from "../../src/exceptions/pick-stopped.exception.ts";
import { GitVersionReader } from "../../src/services/git-version.reader.ts";
import { HooksReader } from "../../src/services/hooks.reader.ts";
import { PickWriter } from "../../src/services/pick.writer.ts";
import { ProgramRunner } from "../../src/services/program-runner.ts";
import { RepositoryReader } from "../../src/services/repository.reader.ts";
import { StatusReader } from "../../src/services/status.reader.ts";
import { CleanUps } from "../fixtures/clean-ups.fixture.ts";
import { DesktopFixture } from "../fixtures/desktop.fixture.ts";
import { RepositoryState } from "../fixtures/repository-state.fixture.ts";
import { RepositoryFixture } from "../fixtures/repository.fixture.ts";
import { ScriptedRunnerFixture } from "../fixtures/scripted-runner.fixture.ts";

describe("PickWriter", () => {
  let template: RepositoryFixture;
  let repository: RepositoryFixture;
  const cleanUps: CleanUps = new CleanUps();
  let supervisor: DesktopFixture;
  let runner: ProgramRunner;
  let repositories: RepositoryReader;
  let statuses: StatusReader;
  let hooks: HooksReader;

  beforeAll(async () => {
    template = await RepositoryFixture.createAsync();
    await template.runGitAsync(["switch", "--quiet", "--create", "side"]);
    await template.writeAsync("b.txt", "side\n");
    await template.runGitAsync(["add", "b.txt"]);
    await template.runGitAsync(["commit", "--quiet", "-m", "Add b"]);
    await template.writeAsync("a.txt", "side a\n");
    await template.runGitAsync(["commit", "--quiet", "-am", "Change a on side"]);
    await template.runGitAsync(["switch", "--quiet", "main"]);
    await template.writeAsync("a.txt", "main a\n");
    await template.runGitAsync(["commit", "--quiet", "-am", "Change a on main"]);
  });

  afterAll(async () => {
    await template.disposeAsync();
  });

  beforeEach(async () => {
    repository = await RepositoryFixture.createAsync(template);
    cleanUps.add(() => repository.disposeAsync());
    supervisor = await DesktopFixture.createAsync(repository.supervisorEnvironment());
    cleanUps.add(() => supervisor.disposeAsync());
    runner = new ProgramRunner(supervisor.context);
    repositories = new RepositoryReader(runner, new GitVersionReader(runner));
    statuses = new StatusReader(runner);
    hooks = new HooksReader(runner);
  });

  afterEach(async () => {
    await cleanUps.runAsync();
  });

  const readAsync = async (): Promise<RepositoryState> => {
    const folders = await repositories.readAsync(repository.folder);
    return new RepositoryState(folders, await statuses.readAsync(folders));
  };
  const idOf = async (revision: string): Promise<string> => (await repository.runGitAsync(["rev-parse", revision])).trim();
  const subjectsAsync = async (count: number): Promise<readonly string[]> => (await repository.runGitAsync(["log", `-${count}`, "--format=%s"])).trim().split("\n");
  const existsAsync = (file: string): Promise<boolean> => access(path.join(repository.gitFolder, file)).then(() => true, () => false);
  const call = { session: "session-1", requestPermissionAsync: () => Promise.reject(new Error("never raised here")), markSending: () => undefined };
  const failsWith = (type: abstract new (...args: never[]) => GitFailureException, gitCode: GitCode | null) => (error: unknown): boolean =>
    error instanceof type && error.code === FailureCode.Git && error.gitCode === gitCode;

  test("cherry-picks a commit onto the current branch as a new commit with its subject, and leaves nothing in progress", async () => {
    const write = new PickWriter(runner, hooks, GitNames.cherryPickMethod, await idOf("side~1"));
    const { folders, status } = await readAsync();
    assert.doesNotThrow(() => write.refuse(status));

    await write.runAsync(folders, status);

    assert.deepEqual(await subjectsAsync(2), ["Add b", "Change a on main"]);
    assert.deepEqual([await repository.runGitAsync(["status", "--porcelain=v1"]), await existsAsync("CHERRY_PICK_HEAD")], ["", false]);
  });

  test("reverts a commit with git's own message, and takes a merge against its first parent", async () => {
    await (await readAsync()).runAsync(new PickWriter(runner, hooks, GitNames.revertMethod, await idOf("HEAD")));
    assert.deepEqual(await subjectsAsync(1), ["Revert \"Change a on main\""]);
    await repository.runGitAsync(["switch", "--quiet", "--create", "merged", "side~1"]);
    await repository.runGitAsync(["switch", "--quiet", "main"]);
    await repository.writeAsync("c.txt", "c\n");
    await repository.runGitAsync(["add", "c.txt"]);
    await repository.runGitAsync(["commit", "--quiet", "-m", "Add c"]);
    await repository.runGitAsync(["merge", "--quiet", "--no-ff", "-m", "Merge merged", "merged"]);

    await (await readAsync()).runAsync(new PickWriter(runner, hooks, GitNames.revertMethod, await idOf("HEAD")));

    assert.deepEqual([await subjectsAsync(1), await repository.runGitAsync(["ls-files", "b.txt"])], [["Revert \"Merge merged\""], ""]);
  });

  test("stops on a conflict with git's output marked untrusted, leaving the cherry-pick in progress to resolve or abort", async () => {
    const write = new PickWriter(runner, hooks, GitNames.cherryPickMethod, await idOf("side"));

    await assert.rejects((await readAsync()).runAsync(write), (error: unknown) =>
      failsWith(PickStoppedException, GitCode.Conflict)(error) && error instanceof PickStoppedException && error.output?.source === UntrustedSource.Repository
      && /CONFLICT/u.test(error.output.text));

    const { status } = await readAsync();
    assert.deepEqual([await existsAsync("CHERRY_PICK_HEAD"), status.entries.some(t => t.conflict !== null)], [true, true]);
    assert.throws(() => write.refuse(status), failsWith(PickDuringOperationException, GitCode.Conflict));
  });

  test("aborts a pick that would change nothing and says so, leaving nothing in progress", async () => {
    await assert.rejects((await readAsync()).runAsync(new PickWriter(runner, hooks, GitNames.cherryPickMethod, await idOf("HEAD"))),
      failsWith(PickEmptyException, null));

    assert.deepEqual([await existsAsync("CHERRY_PICK_HEAD"), await repository.runGitAsync(["status", "--porcelain=v1"]), await subjectsAsync(1)],
      [false, "", ["Change a on main"]]);
  });

  test("fails with git's errors when local changes are in the way or the commit is unknown, and changes nothing", async () => {
    await repository.writeAsync("a.txt", "local\n");

    await assert.rejects((await readAsync()).runAsync(new PickWriter(runner, hooks, GitNames.cherryPickMethod, await idOf("side"))), (error: unknown) =>
      error instanceof GitFailedException && error.output?.source === UntrustedSource.Repository);
    await assert.rejects((await readAsync()).runAsync(new PickWriter(runner, hooks, GitNames.revertMethod, "f".repeat(40))), (error: unknown) =>
      error instanceof GitFailedException);

    assert.deepEqual([await repository.runGitAsync(["status", "--porcelain=v1"]), await existsAsync("CHERRY_PICK_HEAD")], [" M a.txt\n", false]);
  });

  test("names a revert's failure by its command", async () => {
    const scripted = new ScriptedRunnerFixture(supervisor.context);
    scripted.failing = "revert";

    await assert.rejects((await readAsync()).runAsync(new PickWriter(scripted, hooks, GitNames.revertMethod, await idOf("HEAD"))), (error: unknown) =>
      error instanceof GitFailedException && error.message.includes("revert"));
  });

  test("merges a commit into the current branch with git's own message, fast-forwards where it can, and leaves nothing in progress", async () => {
    await (await readAsync()).runAsync(new PickWriter(runner, hooks, GitNames.mergeMethod, await idOf("side~1")));
    assert.deepEqual([(await subjectsAsync(1))[0]?.startsWith("Merge commit '"), await repository.runGitAsync(["ls-files", "b.txt"]), await existsAsync("MERGE_HEAD")],
      [true, "b.txt\n", false]);
    await repository.runGitAsync(["switch", "--quiet", "--create", "ahead"]);
    await repository.writeAsync("c.txt", "c\n");
    await repository.runGitAsync(["add", "c.txt"]);
    await repository.runGitAsync(["commit", "--quiet", "-m", "Add c"]);
    await repository.runGitAsync(["switch", "--quiet", "main"]);

    await (await readAsync()).runAsync(new PickWriter(runner, hooks, GitNames.mergeMethod, await idOf("ahead")));

    assert.deepEqual([await idOf("HEAD"), await repository.runGitAsync(["status", "--porcelain=v1"])], [await idOf("ahead"), ""]);
  });

  test("stops a merge on conflicts, leaving it in progress, and fails with git's errors, leaving nothing in progress, when local changes are in the way", async () => {
    const write = new PickWriter(runner, hooks, GitNames.mergeMethod, await idOf("side"));
    await repository.writeAsync("a.txt", "local\n");

    await assert.rejects((await readAsync()).runAsync(write), (error: unknown) =>
      error instanceof GitFailedException && error.message.includes("merge") && error.output?.source === UntrustedSource.Repository);
    assert.deepEqual([await repository.runGitAsync(["status", "--porcelain=v1"]), await existsAsync("MERGE_HEAD")], [" M a.txt\n", false]);
    await repository.runGitAsync(["checkout", "--quiet", "--", "a.txt"]);

    await assert.rejects((await readAsync()).runAsync(write), failsWith(PickStoppedException, GitCode.Conflict));

    const { status } = await readAsync();
    assert.deepEqual([await existsAsync("MERGE_HEAD"), status.entries.some(t => t.conflict !== null)], [true, true]);
    assert.throws(() => write.refuse(status), failsWith(PickDuringOperationException, GitCode.Conflict));
  });

  test("asks an agent's merge at medium risk, once only, with the commit's subject and the merge hooks that will run", async () => {
    const { folders, status } = await readAsync();
    const id = await idOf("side");
    const hook = path.join(repository.gitFolder, "hooks", "post-merge");
    await writeFile(hook, "#!/bin/sh\n");
    await chmod(hook, 0o755);

    const request = await new PickWriter(runner, hooks, GitNames.mergeMethod, id).requestAsync(folders, status, call);

    assert.deepEqual([request?.action, request?.title, request?.details, request?.risk, request?.options], [
      "git.merge",
      `Merge ${id.slice(0, 7)} into main`,
      [{ label: "Commit", kind: PermissionDetailKind.Text, value: "Change a on side" }, { label: "Hooks that will run", kind: PermissionDetailKind.Text, value: "post-merge" }],
      ToolRisk.Medium,
      [PermissionOption.AllowOnce, PermissionOption.Deny]
    ]);
    await repository.runGitAsync(["switch", "--quiet", "--detach"]);
    const { status: detached } = await readAsync();
    assert.equal((await new PickWriter(runner, hooks, GitNames.mergeMethod, id).requestAsync(folders, detached, call))?.title, `Merge ${id.slice(0, 7)} into the detached HEAD`);
  });

  test("asks an agent's pick at medium risk, once only, with the commit's subject and the hooks that will run", async () => {
    const { folders, status } = await readAsync();
    const id = await idOf("side~1");

    assert.deepEqual(await new PickWriter(runner, hooks, GitNames.cherryPickMethod, id).requestAsync(folders, status, call), {
      action: "git.cherryPick",
      subject: folders.top,
      title: `Cherry-pick ${id.slice(0, 7)} onto main`,
      details: [{ label: "Commit", kind: PermissionDetailKind.Text, value: "Add b" }, { label: "Hooks that will run", kind: PermissionDetailKind.Text, value: "None" }],
      risk: ToolRisk.Medium,
      options: [PermissionOption.AllowOnce, PermissionOption.Deny]
    });
    await repository.runGitAsync(["switch", "--quiet", "--detach"]);
    const { status: detached } = await readAsync();
    assert.equal((await new PickWriter(runner, hooks, GitNames.revertMethod, id).requestAsync(folders, detached, call))?.title, `Revert ${id.slice(0, 7)} on the detached HEAD`);
    assert.equal((await new PickWriter(runner, hooks, GitNames.cherryPickMethod, id).requestAsync(folders, detached, call))?.title,
      `Cherry-pick ${id.slice(0, 7)} onto the detached HEAD`);
    assert.equal((await new PickWriter(runner, hooks, GitNames.revertMethod, id).requestAsync(folders, status, call))?.title, `Revert ${id.slice(0, 7)} on main`);
  });
});
