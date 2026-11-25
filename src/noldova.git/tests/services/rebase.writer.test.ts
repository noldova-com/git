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
import { GitCode, type GitStatus, RebaseAction, RebaseStep, UndoMode, UntrustedSource } from "@noldova/git.protocol";

import { GitFailedException } from "../../src/exceptions/git-failed.exception.ts";
import { PickDuringOperationException } from "../../src/exceptions/pick-during-operation.exception.ts";
import { RebaseChangesInTheWayException } from "../../src/exceptions/rebase-changes-in-the-way.exception.ts";
import { RebasePlanMovedException } from "../../src/exceptions/rebase-plan-moved.exception.ts";
import { RebaseStoppedException } from "../../src/exceptions/rebase-stopped.exception.ts";
import type { RepositoryFolders } from "../../src/models/repository-folders.ts";
import { GitVersionReader } from "../../src/services/git-version.reader.ts";
import { HooksReader } from "../../src/services/hooks.reader.ts";
import { Resources } from "../../src/resources.ts";
import { RebaseWriter } from "../../src/services/rebase.writer.ts";
import { RepositoryReader } from "../../src/services/repository.reader.ts";
import { StatusReader } from "../../src/services/status.reader.ts";
import { CleanUps } from "../fixtures/clean-ups.fixture.ts";
import { DesktopFixture } from "../fixtures/desktop.fixture.ts";
import { RepositoryFixture } from "../fixtures/repository.fixture.ts";
import { ScriptedRunnerFixture } from "../fixtures/scripted-runner.fixture.ts";

describe("RebaseWriter", () => {
  let template: RepositoryFixture;
  let repository: RepositoryFixture;
  const cleanUps: CleanUps = new CleanUps();
  let supervisor: DesktopFixture;
  let runner: ScriptedRunnerFixture;
  let repositories: RepositoryReader;
  let statuses: StatusReader;
  let hooks: HooksReader;

  beforeAll(async () => {
    template = await RepositoryFixture.createAsync();
    await template.runGitAsync(["switch", "--quiet", "--create", "feature"]);
    await template.writeAsync("b.txt", "b\n");
    await template.runGitAsync(["add", "b.txt"]);
    await template.runGitAsync(["-c", "user.name=Other", "-c", "user.email=other@example.invalid", "commit", "--quiet", "-m", "Add b"]);
    await template.writeAsync("c.txt", "c\n");
    await template.runGitAsync(["add", "c.txt"]);
    await template.runGitAsync(["commit", "--quiet", "-m", "Add c"]);
    await template.runGitAsync(["branch", "stacked"]);
    await template.writeAsync("b.txt", "b fixed\n");
    await template.runGitAsync(["commit", "--quiet", "-am", "fixup! Add b"]);
    await template.writeAsync("d.txt", "debug\n");
    await template.runGitAsync(["add", "d.txt"]);
    await template.runGitAsync(["commit", "--quiet", "-m", "WIP debug"]);
    await template.runGitAsync(["branch", "wip"]);
    await template.runGitAsync(["switch", "--quiet", "main"]);
    await template.writeAsync("e.txt", "main\n");
    await template.runGitAsync(["add", "e.txt"]);
    await template.runGitAsync(["commit", "--quiet", "-m", "Add e"]);
    await template.runGitAsync(["switch", "--quiet", "feature"]);
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
    repositories = new RepositoryReader(runner, new GitVersionReader(runner));
    statuses = new StatusReader(runner);
    hooks = new HooksReader(runner);
  });

  afterEach(async () => {
    await cleanUps.runAsync();
  });

  const readAsync = async (): Promise<[RepositoryFolders, GitStatus]> => {
    const folders = await repositories.readAsync(repository.folder);
    return [folders, await statuses.readAsync(folders)];
  };
  const idOf = async (revision: string): Promise<string> => (await repository.runGitAsync(["rev-parse", revision])).trim();
  const logAsync = async (range: string): Promise<string> => repository.runGitAsync(["log", "--format=%an|%s|%b", range]);
  const isRebasingAsync = (): Promise<boolean> => access(path.join(repository.gitFolder, "rebase-merge")).then(() => true, () => false);
  const writerAsync = async (steps: readonly (readonly [string, RebaseAction, string | null])[], updateRefs: boolean = true): Promise<RebaseWriter> =>
    new RebaseWriter(runner, hooks, await idOf("main"), await Promise.all(steps.map(async ([revision, action, message]) => new RebaseStep(await idOf(revision), action, message))),
      updateRefs);
  const call = { session: "session-1", requestPermissionAsync: () => Promise.reject(new Error("never raised here")), markSending: () => undefined };

  test("rewords a commit keeping its author, folds a fixup into it, reorders, drops, and moves the stacked branches after their commits", async () => {
    const write = await writerAsync([
      ["feature~3", RebaseAction.Reword, "Add b, reworded\n\nWith a body."],
      ["feature~1", RebaseAction.Fixup, null],
      ["feature~2", RebaseAction.Pick, null],
      ["feature", RebaseAction.Drop, null]
    ]);
    const [folders, status] = await readAsync();
    assert.doesNotThrow(() => write.refuse(status));

    await write.runAsync(folders, status);

    assert.equal(await logAsync("main..feature"), "Noldova Test|Add c|\nOther|Add b, reworded|With a body.\n");
    assert.equal(await repository.runGitAsync(["show", "feature~1:b.txt"]), "b fixed\n");
    assert.deepEqual([await idOf("stacked"), await idOf("wip")], [await idOf("feature"), await idOf("feature")]);
    assert.deepEqual([await isRebasingAsync(), await repository.runGitAsync(["status", "--porcelain=v1"]), write.undo], [false, "", UndoMode.Keep]);
  });

  test("gives a squash group the last squash's message, and leaves the other branches where they are without updateRefs", async () => {
    const stacked = await idOf("stacked");
    await (await writerAsync([
      ["feature~3", RebaseAction.Pick, null],
      ["feature~1", RebaseAction.Squash, "Add b, squashed"],
      ["feature~2", RebaseAction.Pick, null],
      ["feature", RebaseAction.Drop, null]
    ], false)).runAsync(...await readAsync());

    assert.equal(await repository.runGitAsync(["log", "--format=%s", "main..feature"]), "Add c\nAdd b, squashed\n");
    assert.equal(await idOf("stacked"), stacked);
  });

  test("stops at an edit step with the rebase in progress, and refuses another while it is", async () => {
    const write = await writerAsync([["feature~3", RebaseAction.Edit, null], ["feature~2", RebaseAction.Pick, null], ["feature~1", RebaseAction.Drop, null], ["feature", RebaseAction.Drop, null]]);
    await write.runAsync(...await readAsync());

    assert.deepEqual([await isRebasingAsync(), (await repository.runGitAsync(["log", "-1", "--format=%s"])).trim()], [true, "Add b"]);
    const [, status] = await readAsync();
    assert.throws(() => write.refuse(status), (error: unknown) => error instanceof PickDuringOperationException && error.gitCode === GitCode.Conflict);
  });

  test("rebases a detached HEAD, leaving every branch where it is but those on the commits it replays", async () => {
    const feature = await idOf("feature");
    await repository.runGitAsync(["switch", "--quiet", "--detach", "feature~2"]);

    await (await writerAsync([["HEAD~1", RebaseAction.Pick, null], ["HEAD", RebaseAction.Pick, null]])).runAsync(...await readAsync());

    assert.equal(await repository.runGitAsync(["log", "--format=%s", "main..HEAD"]), "Add c\nAdd b\n");
    assert.deepEqual([await idOf("stacked"), await idOf("feature")], [await idOf("HEAD"), feature]);
  });

  test("leaves the rebase stopped on a conflict for the person to resolve, with git's output marked untrusted", async () => {
    await assert.rejects((await writerAsync([["feature~1", RebaseAction.Pick, null], ["feature~3", RebaseAction.Pick, null], ["feature~2", RebaseAction.Drop, null], ["feature", RebaseAction.Drop, null]])).runAsync(...await readAsync()),
      (error: unknown) => error instanceof RebaseStoppedException && error.gitCode === GitCode.Conflict && error.output?.source === UntrustedSource.Repository);

    assert.equal(await isRebasingAsync(), true);
  });

  test("refuses steps that aren't the branch's commits since the target, as after a commit or a switch since the plan was read, changing nothing", async () => {
    const steps: readonly (readonly [string, RebaseAction, string | null])[] = [["feature~3", RebaseAction.Pick, null], ["feature~2", RebaseAction.Pick, null], ["feature~1", RebaseAction.Pick, null], ["feature", RebaseAction.Pick, null]];
    const write = await writerAsync(steps);
    await repository.writeAsync("f.txt", "later\n");
    await repository.runGitAsync(["add", "f.txt"]);
    await repository.runGitAsync(["commit", "--quiet", "-m", "Commit made after the plan"]);
    const head = await idOf("HEAD");

    await assert.rejects(write.runAsync(...await readAsync()), RebasePlanMovedException);
    await assert.rejects((await writerAsync(steps.slice(1))).runAsync(...await readAsync()), RebasePlanMovedException);
    assert.deepEqual([await idOf("HEAD"), await isRebasingAsync()], [head, false]);
  });

  test("refuses changes to tracked files before git runs, naming them, but not untracked files", async () => {
    const write = await writerAsync([["feature~3", RebaseAction.Pick, null]]);
    await repository.writeAsync("new.txt", "new\n");
    const [, untracked] = await readAsync();
    assert.doesNotThrow(() => write.refuse(untracked));
    await repository.writeAsync("c.txt", "changed\n");

    const [, status] = await readAsync();
    assert.throws(() => write.refuse(status), (error: unknown) =>
      error instanceof RebaseChangesInTheWayException && error.gitCode === GitCode.ChangesInTheWay && error.paths.join() === "c.txt"
      && error.message === "You have changes to c.txt, so the rebase didn't start. Commit or stash them first.");
    assert.equal(Resources.formatRebaseChangesInTheWay(["a.txt", "b.txt"], 4), "You have changes to a.txt, b.txt and 2 others, so the rebase didn't start. Commit or stash them first.");
  });

  test("aborts a rebase git refuses, and fails with git's errors, as it does when making a message's commit or reading the branches fails", async () => {
    const commands: string[] = [];
    runner.starting = command => commands.push(command);
    const failsWith = (command: string) => (error: unknown): boolean =>
      error instanceof GitFailedException && error.message.includes(command) && error.output?.source === UntrustedSource.Repository;
    const head = await idOf("HEAD");
    const rest: readonly (readonly [string, RebaseAction, string | null])[] = [["feature~2", RebaseAction.Pick, null], ["feature~1", RebaseAction.Pick, null], ["feature", RebaseAction.Pick, null]];

    runner.failing = "--interactive";
    runner.failingCode = 128;
    await assert.rejects((await writerAsync([["feature~3", RebaseAction.Pick, null], ...rest])).runAsync(...await readAsync()), failsWith("rebase"));
    assert.ok(commands.some(t => t.endsWith("rebase --abort")), commands.join("\n"));
    runner.failing = "commit-tree";
    await assert.rejects((await writerAsync([["feature~3", RebaseAction.Reword, "Add b again"], ...rest])).runAsync(...await readAsync()), failsWith("commit-tree"));
    runner.failing = "for-each-ref --format=%(objectname) %(refname) refs/heads";
    await assert.rejects((await writerAsync([["feature~3", RebaseAction.Pick, null], ...rest])).runAsync(...await readAsync()), failsWith("for-each-ref"));
    runner.failing = "rev-list --no-merges";
    await assert.rejects((await writerAsync([["feature~3", RebaseAction.Pick, null], ...rest])).runAsync(...await readAsync()), failsWith("rev-list"));

    assert.deepEqual([await idOf("HEAD"), await isRebasingAsync()], [head, false]);
  });

  test("asks at medium risk, once only, with the steps as git will take them and the hooks that will run", async () => {
    const hook = path.join(repository.gitFolder, "hooks", "post-rewrite");
    await writeFile(hook, "#!/bin/sh\n");
    await chmod(hook, 0o755);
    const [folders, status] = await readAsync();
    const short = async (revision: string): Promise<string> => (await idOf(revision)).slice(0, 7);
    const write = await writerAsync([
      ["feature~3", RebaseAction.Reword, "Add b, reworded\n\nWith a body."],
      ["feature~1", RebaseAction.Fixup, null],
      ["feature~2", RebaseAction.Pick, null],
      ["feature", RebaseAction.Drop, null]
    ]);

    assert.deepEqual(await write.requestAsync(folders, status, call), {
      action: "git.rebase",
      subject: folders.top,
      title: `Rebase 3 commits of feature onto ${await short("main")}`,
      details: [
        {
          label: "Steps",
          kind: PermissionDetailKind.Code,
          value: [
            `Reword ${await short("feature~3")} Add b, reworded`,
            `Fixup ${await short("feature~1")} fixup! Add b`,
            `Pick ${await short("feature~2")} Add c`,
            `Drop ${await short("feature")} WIP debug`
          ].join("\n")
        },
        { label: "Hooks that will run", kind: PermissionDetailKind.Text, value: "post-rewrite" }
      ],
      risk: ToolRisk.Medium,
      options: [PermissionOption.AllowOnce, PermissionOption.Deny]
    });
    await repository.runGitAsync(["switch", "--quiet", "--detach"]);
    const [, detached] = await readAsync();
    assert.equal((await write.requestAsync(folders, detached, call))?.title, `Rebase 3 commits of the detached HEAD onto ${await short("main")}`);
    const unknown = new RebaseWriter(runner, hooks, await idOf("main"), [new RebaseStep("f".repeat(40), RebaseAction.Pick, null)], false);
    assert.deepEqual((await unknown.requestAsync(folders, status, call))?.details[0]?.value, "Pick fffffff ");
    runner.failing = "--no-walk=unsorted";
    await assert.rejects(write.requestAsync(folders, status, call), (error: unknown) => error instanceof GitFailedException && error.message.includes("log"));
  });
});
