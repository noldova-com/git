/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */
import assert from "node:assert/strict";
import path from "node:path";

import { afterAll, afterEach, beforeAll, beforeEach, describe, test } from "vitest";

import { PermissionDetailKind, PermissionOption, ToolRisk } from "@noldova/desktop.runtime";
import { FailureCode, GitNames, type GitStatus, ResetMode, UndoMode } from "@noldova/git.protocol";

import { GitFailedException } from "../../src/exceptions/git-failed.exception.ts";
import type { GitFailureException } from "../../src/exceptions/git-failure.exception.ts";
import { ResetDuringOperationException } from "../../src/exceptions/reset-during-operation.exception.ts";
import { ResetNoCommitException } from "../../src/exceptions/reset-no-commit.exception.ts";
import { UndoCommitPushedException } from "../../src/exceptions/undo-commit-pushed.exception.ts";
import { UndoCommitRootException } from "../../src/exceptions/undo-commit-root.exception.ts";
import type { RepositoryFolders } from "../../src/models/repository-folders.ts";
import { GitVersionReader } from "../../src/services/git-version.reader.ts";
import { ProgramRunner } from "../../src/services/program-runner.ts";
import { RepositoryReader } from "../../src/services/repository.reader.ts";
import { ResetWriter } from "../../src/services/reset.writer.ts";
import { StatusReader } from "../../src/services/status.reader.ts";
import { CleanUps } from "../fixtures/clean-ups.fixture.ts";
import { DesktopFixture } from "../fixtures/desktop.fixture.ts";
import { RepositoryFixture } from "../fixtures/repository.fixture.ts";

describe("ResetWriter", () => {
  let template: RepositoryFixture;
  let repository: RepositoryFixture;
  const cleanUps: CleanUps = new CleanUps();
  let supervisor: DesktopFixture;
  let runner: ProgramRunner;
  let repositories: RepositoryReader;
  let statuses: StatusReader;

  beforeAll(async () => {
    template = await RepositoryFixture.createAsync();
    await template.writeAsync("b.txt", "b\n");
    await template.runGitAsync(["add", "b.txt"]);
    await template.runGitAsync(["commit", "--quiet", "-m", "Add b"]);
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
  });

  afterEach(async () => {
    await cleanUps.runAsync();
  });

  const readAsync = async (): Promise<[RepositoryFolders, GitStatus]> => {
    const folders = await repositories.readAsync(repository.folder);
    return [folders, await statuses.readAsync(folders)];
  };
  const idOf = async (revision: string): Promise<string> => (await repository.runGitAsync(["rev-parse", revision])).trim();
  const statusOf = async (): Promise<string> => await repository.runGitAsync(["status", "--porcelain=v1"]);
  const resetAsync = async (write: ResetWriter): Promise<void> => {
    const [folders, status] = await readAsync();
    write.refuse(status);
    await write.runAsync(folders, status);
  };
  const failsWith = (type: abstract new (...args: never[]) => GitFailureException, code: FailureCode) => (error: unknown): boolean =>
    error instanceof type && error.code === code;

  test("resets softly with the changes staged, mixed with them unstaged, and keeping local changes, each journaled to be undone its own way", async () => {
    const first = await idOf("HEAD~1");
    const second = await idOf("HEAD");
    const writes = [ResetMode.Soft, ResetMode.Mixed, ResetMode.Keep].map(t => new ResetWriter(runner, t, first));
    assert.deepEqual(writes.map(t => [t.method, t.undo]), [[GitNames.resetMethod, UndoMode.Refs], [GitNames.resetMethod, UndoMode.Mixed], [GitNames.resetMethod, UndoMode.Keep]]);

    await resetAsync(writes[0] as ResetWriter);
    assert.equal(await statusOf(), "A  b.txt\n");
    await repository.runGitAsync(["reset", "--quiet", "--hard", second]);
    await resetAsync(writes[1] as ResetWriter);
    assert.equal(await statusOf(), "?? b.txt\n");
    await repository.runGitAsync(["reset", "--quiet", "--hard", second]);
    await repository.writeAsync("a.txt", "local\n");
    await resetAsync(writes[2] as ResetWriter);
    assert.deepEqual([await idOf("HEAD"), await statusOf()], [first, " M a.txt\n"]);
  });

  test("passes on a keep reset git refuses, as over a local change to a file the reset changes, leaving the branch where it was", async () => {
    const first = await idOf("HEAD~1");
    const second = await idOf("HEAD");
    await repository.writeAsync("b.txt", "local b\n");

    await assert.rejects(resetAsync(new ResetWriter(runner, ResetMode.Keep, first)), failsWith(GitFailedException, FailureCode.Unavailable));
    assert.equal(await idOf("HEAD"), second);
  });

  test("undoes the last commit with its changes staged, refusing the branch's first commit and a commit already on the upstream", async () => {
    const first = await idOf("HEAD~1");
    const undo = new ResetWriter(runner, ResetMode.Mixed, null);
    assert.deepEqual([undo.method, undo.undo], [GitNames.undoCommitMethod, UndoMode.Refs]);

    await resetAsync(undo);
    assert.deepEqual([await idOf("HEAD"), await statusOf()], [first, "A  b.txt\n"]);
    await repository.runGitAsync(["commit", "--quiet", "-m", "Add b"]);
    await repository.runGitAsync(["reset", "--quiet", "--hard", first]);
    await assert.rejects(resetAsync(undo), failsWith(UndoCommitRootException, FailureCode.Refused));

    const remote = path.join(repository.root, "remote.git");
    await repository.runGitAsync(["clone", "--quiet", "--bare", repository.folder, remote]);
    await repository.runGitAsync(["remote", "add", "origin", remote]);
    await repository.runGitAsync(["fetch", "--quiet", "origin"]);
    await repository.runGitAsync(["branch", "--quiet", "--set-upstream-to=origin/main"]);
    await assert.rejects(resetAsync(undo), failsWith(UndoCommitPushedException, FailureCode.Refused));
    await repository.runGitAsync(["commit", "--quiet", "--allow-empty", "-m", "Local"]);
    await resetAsync(undo);
    assert.equal(await idOf("HEAD"), first);
  });

  test("refuses a branch with no commit and a reset while a merge stops on a conflict, and passes on a commit git can't find", async () => {
    await repository.runGitAsync(["switch", "--quiet", "--orphan", "fresh"]);
    await assert.rejects(resetAsync(new ResetWriter(runner, ResetMode.Soft, null)), failsWith(ResetNoCommitException, FailureCode.Refused));

    await repository.runGitAsync(["switch", "--quiet", "--force", "main"]);
    await repository.runGitAsync(["switch", "--quiet", "--create", "side", "HEAD~1"]);
    await repository.writeAsync("b.txt", "side b\n");
    await repository.runGitAsync(["add", "b.txt"]);
    await repository.runGitAsync(["commit", "--quiet", "-m", "Add b on side"]);
    await repository.runGitAsync(["merge", "--quiet", "main"]).catch(() => undefined);
    await assert.rejects(resetAsync(new ResetWriter(runner, ResetMode.Soft, await idOf("main"))), failsWith(ResetDuringOperationException, FailureCode.Refused));

    await repository.runGitAsync(["merge", "--abort"]);
    const [folders, status] = await readAsync();
    await assert.rejects(new ResetWriter(runner, ResetMode.Soft, "0".repeat(40)).runAsync(folders, status), failsWith(GitFailedException, FailureCode.Unavailable));
    await assert.rejects(new ResetWriter(runner, ResetMode.Soft, "0".repeat(40)).requestAsync(folders, status, null), failsWith(GitFailedException, FailureCode.Unavailable));
  });

  test("asks an agent's reset and undo of the last commit at high risk, once, with the commit the branch moves to", async () => {
    const first = await idOf("HEAD~1");
    const [folders, status] = await readAsync();
    const short = first.slice(0, 7);
    const ask = async (write: ResetWriter, on: GitStatus = status): Promise<unknown> => await write.requestAsync(folders, on, null);
    const request = (action: string, title: string): unknown => ({
      action,
      subject: folders.top,
      title,
      details: [{ label: "Commit", kind: PermissionDetailKind.Text, value: `${short} Start` }],
      risk: ToolRisk.High,
      options: [PermissionOption.AllowOnce, PermissionOption.Deny]
    });

    assert.deepEqual(await ask(new ResetWriter(runner, ResetMode.Soft, first)), request(GitNames.resetMethod, `Reset main to ${short}, keeping the changes staged`));
    assert.deepEqual(await ask(new ResetWriter(runner, ResetMode.Mixed, first)), request(GitNames.resetMethod, `Reset main to ${short}, keeping the changes unstaged`));
    assert.deepEqual(await ask(new ResetWriter(runner, ResetMode.Keep, null)), request(GitNames.undoCommitMethod, "Undo the last commit on main"));
    await repository.runGitAsync(["switch", "--quiet", "--detach"]);
    const [, detached] = await readAsync();
    assert.deepEqual(await ask(new ResetWriter(runner, ResetMode.Keep, first), detached), request(GitNames.resetMethod, `Reset the detached HEAD to ${short}, keeping local changes`));
    assert.deepEqual(await ask(new ResetWriter(runner, ResetMode.Soft, null), detached), request(GitNames.undoCommitMethod, "Undo the last commit on the detached HEAD"));
  });
});
