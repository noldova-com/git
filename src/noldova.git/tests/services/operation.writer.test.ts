/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import path from "node:path";

import { afterAll, afterEach, beforeAll, beforeEach, describe, test } from "vitest";

import { PermissionDetailKind, PermissionOption, ToolRisk } from "@noldova/desktop.runtime";
import { ConflictResolution, GitNames, OperationKind, UntrustedSource } from "@noldova/git.protocol";

import { CommitConflictsException } from "../../src/exceptions/commit-conflicts.exception.ts";
import { ContinueMarkersLeftException } from "../../src/exceptions/continue-markers-left.exception.ts";
import { GitFailedException } from "../../src/exceptions/git-failed.exception.ts";
import { NoOperationException } from "../../src/exceptions/no-operation.exception.ts";
import { PickStoppedException } from "../../src/exceptions/pick-stopped.exception.ts";
import { FilterOptionsReader } from "../../src/services/filter-options.reader.ts";
import { GitVersionReader } from "../../src/services/git-version.reader.ts";
import { HooksReader } from "../../src/services/hooks.reader.ts";
import { OperationWriter } from "../../src/services/operation.writer.ts";
import { PickWriter } from "../../src/services/pick.writer.ts";
import { ProgramRunner } from "../../src/services/program-runner.ts";
import { RepositoryReader } from "../../src/services/repository.reader.ts";
import { ResolveConflictWriter } from "../../src/services/resolve-conflict.writer.ts";
import { StatusReader } from "../../src/services/status.reader.ts";
import { CleanUps } from "../fixtures/clean-ups.fixture.ts";
import { DesktopFixture } from "../fixtures/desktop.fixture.ts";
import { RepositoryState } from "../fixtures/repository-state.fixture.ts";
import { RepositoryFixture } from "../fixtures/repository.fixture.ts";
import { ScriptedRunnerFixture } from "../fixtures/scripted-runner.fixture.ts";

describe("OperationWriter", () => {
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
    await template.writeAsync("a.txt", "one\ntwo\nthree\n");
    await template.runGitAsync(["commit", "--quiet", "-am", "Base"]);
    await template.runGitAsync(["switch", "--quiet", "--create", "side"]);
    await template.writeAsync("a.txt", "one\nside 1\nthree\n");
    await template.runGitAsync(["commit", "--quiet", "-am", "Side 1"]);
    await template.writeAsync("a.txt", "one\nside 2\nthree\n");
    await template.runGitAsync(["commit", "--quiet", "-am", "Side 2"]);
    await template.runGitAsync(["switch", "--quiet", "main"]);
    await template.writeAsync("a.txt", "one\nmain\nthree\n");
    await template.runGitAsync(["commit", "--quiet", "-am", "Main"]);
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
  const continuing = (programs: ProgramRunner = runner): OperationWriter => new OperationWriter(programs, hooks, GitNames.continueOperationMethod);
  const aborting = (programs: ProgramRunner = runner): OperationWriter => new OperationWriter(programs, hooks, GitNames.abortOperationMethod);
  const writeAsync = async (write: OperationWriter): Promise<void> => {
    const { folders, status } = await readAsync();
    write.refuse(status);
    await write.runAsync(folders, status);
  };
  const conflictAsync = (gitArguments: readonly string[]): Promise<string> => repository.runGitAsync(gitArguments).catch(() => "");
  const resolveAsync = async (text: string): Promise<void> => {
    await repository.writeAsync("a.txt", text);
    await repository.runGitAsync(["add", "a.txt"]);
  };
  const existsAsync = (file: string): Promise<boolean> => access(path.join(repository.gitFolder, file)).then(() => true, () => false);
  const worktreeAsync = (): Promise<string> => readFile(path.join(repository.folder, "a.txt"), "utf8");
  const call = { session: "session-1", requestPermissionAsync: () => Promise.reject(new Error("never raised here")), markSending: () => undefined };

  test("continues a merge once its files are resolved, committing git's message without an editor", async () => {
    await conflictAsync(["merge", "--quiet", "side"]);
    await resolveAsync("one\nmerged\nthree\n");

    await writeAsync(continuing());

    assert.deepEqual([await existsAsync("MERGE_HEAD"), (await repository.runGitAsync(["log", "-1", "--format=%P%x00%s"])).trim().split("\0")[1]],
      [false, "Merge branch 'side'"]);
  });

  test("answers normally when a rebase stops at its next conflict, and finishes on the last continue", async () => {
    await repository.runGitAsync(["switch", "--quiet", "side"]);
    await conflictAsync(["rebase", "main"]);
    await resolveAsync("one\nrebased 1\nthree\n");

    await writeAsync(continuing());

    const { status: stopped } = await readAsync();
    assert.deepEqual([stopped.operation?.kind, stopped.entries.find(t => t.path === "a.txt")?.conflict !== null], [OperationKind.Rebase, true]);
    await resolveAsync("one\nrebased 2\nthree\n");
    await writeAsync(continuing());
    assert.deepEqual([await existsAsync("rebase-merge"), (await repository.runGitAsync(["log", "-3", "--format=%s"])).trim().split("\n")],
      [false, ["Side 2", "Side 1", "Main"]]);
  });

  test("aborts a merge, putting the branch and the worktree back", async () => {
    await conflictAsync(["merge", "--quiet", "side"]);
    const { status } = await readAsync();
    assert.doesNotThrow(() => aborting().refuse(status));

    await writeAsync(aborting());

    assert.deepEqual([await existsAsync("MERGE_HEAD"), await worktreeAsync()], [false, "one\nmain\nthree\n"]);
  });

  test("refuses with no operation in progress, and refuses to continue while a file is unmerged", async () => {
    const { folders, status: clean } = await readAsync();
    for (const write of [continuing(), aborting()]) {
      assert.throws(() => write.refuse(clean), (error: unknown) => error instanceof NoOperationException);
      await assert.rejects(write.runAsync(folders, clean), (error: unknown) => error instanceof NoOperationException);
      await assert.rejects(write.requestAsync(folders, clean, call), (error: unknown) => error instanceof NoOperationException);
    }
    await conflictAsync(["merge", "--quiet", "side"]);
    const { status: conflicted } = await readAsync();

    assert.throws(() => continuing().refuse(conflicted), (error: unknown) => error instanceof CommitConflictsException);
  });

  test("refuses to continue while a staged file still has marker lines, naming them as untrusted text", async () => {
    await conflictAsync(["merge", "--quiet", "side"]);
    await repository.runGitAsync(["add", "a.txt"]);

    await assert.rejects(writeAsync(continuing()), (error: unknown) => error instanceof ContinueMarkersLeftException
      && error.output?.source === UntrustedSource.Repository && /^a\.txt:\d+: leftover conflict marker$/mu.test(error.output.text));
    assert.equal(await existsAsync("MERGE_HEAD"), true);
  });

  test("records a resolution on continue, so the same conflict picked again comes back resolved", async () => {
    const side = (await repository.runGitAsync(["rev-parse", "side~1"])).trim();
    const pick = async (): Promise<void> => {
      await assert.rejects((await readAsync()).runAsync(new PickWriter(runner, hooks, GitNames.cherryPickMethod, side)),
        (error: unknown) => error instanceof PickStoppedException);
    };
    await pick();
    const resolve = new ResolveConflictWriter(runner, hooks, new FilterOptionsReader(runner), "a.txt", ConflictResolution.Text, "one\nboth\nthree\n");
    const { folders, status } = await readAsync();
    resolve.refuse(status);
    await resolve.runAsync(folders, status);
    await writeAsync(continuing());
    await repository.runGitAsync(["reset", "--quiet", "--hard", "HEAD~1"]);

    await pick();

    assert.deepEqual([await worktreeAsync(), (await readAsync()).status.entries.find(t => t.path === "a.txt")?.conflict !== null], ["one\nboth\nthree\n", true]);
  });

  test("fails with git's output as untrusted text when a continue, an abort or the marker check fails otherwise", async () => {
    await conflictAsync(["merge", "--quiet", "side"]);
    await resolveAsync("one\nmerged\nthree\n");
    const scripted = new ScriptedRunnerFixture(supervisor.context);

    for (const [failing, code, write] of [["merge --continue", 1, continuing(scripted)], ["merge --abort", 128, aborting(scripted)],
      ["diff --check", 128, continuing(scripted)]] as const) {
      scripted.failing = failing;
      scripted.failingCode = code;
      await assert.rejects(writeAsync(write), (error: unknown) => error instanceof GitFailedException && error.output?.text.includes("scripted failure") === true, failing);
    }
  });

  test("asks an agent's continue or abort at high risk, once only, with the hooks a continue runs or what an abort drops", async () => {
    await conflictAsync(["cherry-pick", "side"]);
    const { folders, status } = await readAsync();

    assert.deepEqual(await continuing().requestAsync(folders, status, call), {
      action: "git.continueOperation",
      subject: folders.top,
      title: "Continue the cherry-pick",
      details: [{ label: "Hooks that will run", kind: PermissionDetailKind.Text, value: "None" }],
      risk: ToolRisk.High,
      options: [PermissionOption.AllowOnce, PermissionOption.Deny]
    });
    assert.deepEqual(await aborting().requestAsync(folders, status, call), {
      action: "git.abortOperation",
      subject: folders.top,
      title: "Abort the cherry-pick",
      details: [{ label: "Note", kind: PermissionDetailKind.Text,
        value: "Aborting puts the branch, the index and the worktree back as they were before it started, and drops every resolution made since." }],
      risk: ToolRisk.High,
      options: [PermissionOption.AllowOnce, PermissionOption.Deny]
    });
  });
});
