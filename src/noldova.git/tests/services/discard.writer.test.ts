/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { mkdir, readFile } from "node:fs/promises";
import path from "node:path";

import { afterAll, afterEach, beforeAll, beforeEach, describe, test } from "vitest";

import { CaptureOutcome, CaptureResult } from "@noldova/checkpoints.protocol";
import { FailureCode, FileState, GitNames, GitStatus, StatusEntry, SubmoduleStatus, UndoMode, UntrustedSource } from "@noldova/git.protocol";

import { CheckpointFailedException } from "../../src/exceptions/checkpoint-failed.exception.ts";
import { DiscardRefusedException } from "../../src/exceptions/discard-refused.exception.ts";
import { GitFailedException } from "../../src/exceptions/git-failed.exception.ts";
import { CheckpointStore } from "../../src/services/checkpoint-store.ts";
import { DiscardWriter } from "../../src/services/discard.writer.ts";
import { GitVersionReader } from "../../src/services/git-version.reader.ts";
import { ProgramRunner } from "../../src/services/program-runner.ts";
import { RepositoryReader } from "../../src/services/repository.reader.ts";
import { StatusReader } from "../../src/services/status.reader.ts";
import { CleanUps } from "../fixtures/clean-ups.fixture.ts";
import { DesktopFixture } from "../fixtures/desktop.fixture.ts";
import { FakeCheckpoints } from "../fixtures/fake-checkpoints.fixture.ts";
import { RepositoryState } from "../fixtures/repository-state.fixture.ts";
import { RepositoryFixture } from "../fixtures/repository.fixture.ts";

describe("DiscardWriter", () => {
  let template: RepositoryFixture;
  let repository: RepositoryFixture;
  const cleanUps: CleanUps = new CleanUps();
  let supervisor: DesktopFixture;
  let runner: ProgramRunner;
  let repositories: RepositoryReader;
  let statuses: StatusReader;
  const none: CheckpointStore = new CheckpointStore(() => null);

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
    runner = new ProgramRunner(supervisor.context);
    repositories = new RepositoryReader(runner, new GitVersionReader(runner));
    statuses = new StatusReader(runner);
  });

  afterEach(async () => {
    await cleanUps.runAsync();
  });

  const readAsync = async (): Promise<RepositoryState> => {
    const folders = await repositories.readAsync(repository.folder);
    return new RepositoryState(folders, await statuses.readAsync(folders));
  };
  const porcelainAsync = async (): Promise<string> => await repository.runGitAsync(["status", "--porcelain=v1", "--untracked-files=all"]);
  const contentAsync = async (file: string): Promise<string> => await readFile(path.join(repository.folder, file), "utf8");
  const isThere = (...parts: string[]): boolean => existsSync(path.join(repository.folder, ...parts));
  const withEntries = (status: GitStatus, entries: readonly StatusEntry[]): GitStatus =>
    new GitStatus(status.branch, status.head, status.upstream, entries, status.truncated, status.fingerprint, status.operation, status.remote);
  const refused = (file: string) => (error: unknown): boolean => error instanceof DiscardRefusedException && error.code === FailureCode.Refused
    && error.message === `${file} has no change in the working folder that a discard can put back: it is unchanged, conflicted or a submodule. Read the status again.`;
  const failed = (command: string) => (error: unknown): boolean => error instanceof GitFailedException && error.code === FailureCode.Unavailable
    && error.message === `git ${command} failed; its output comes with the failure as untrusted text.` && error.output?.source === UntrustedSource.Repository;

  test("is the person's own click: it never asks, and without the checkpoints module it takes no checkpoint and can't be undone", async () => {
    await repository.writeAsync("a.txt", "edited\n");
    const { folders, status } = await readAsync();
    const write = new DiscardWriter(runner, ["a.txt"], none);

    await write.runAsync(folders, status);

    assert.deepEqual([write.method, write.undo, write.checkpoint, await write.requestAsync()], [GitNames.discardMethod, UndoMode.None, null, null]);
  });

  test("takes a checkpoint of the working folder before git discards anything, so the journal can undo it from there", async () => {
    await repository.writeAsync("a.txt", "edited\n");
    const { folders, status } = await readAsync();
    const checkpoints = new FakeCheckpoints();
    const seen: string[] = [];
    checkpoints.onCapture = async () => {
      seen.push(await contentAsync("a.txt"));
    };
    const write = new DiscardWriter(runner, ["a.txt"], new CheckpointStore(() => checkpoints));
    const before = write.undo;

    await write.runAsync(folders, status);

    assert.deepEqual([before, write.undo, write.checkpoint, seen, checkpoints.captures.map(t => [t.label, t.folder.path])],
      [UndoMode.None, UndoMode.Checkpoint, { id: FakeCheckpoints.id, paths: ["a.txt"] }, ["edited\n"], [["Before discarding 1 file in Git", folders.top]]]);
    assert.equal(await contentAsync("a.txt"), "a\n");
  });

  test("discards nothing when the checkpoint before it can't be taken", async () => {
    await repository.writeAsync("a.txt", "edited\n");
    await repository.writeAsync("new.txt", "new\n");
    const { folders, status } = await readAsync();
    const checkpoints = new FakeCheckpoints();
    checkpoints.capture = new CaptureResult(CaptureOutcome.HeldUp, null, null, null);
    const write = new DiscardWriter(runner, ["a.txt", "new.txt"], new CheckpointStore(() => checkpoints));

    await assert.rejects(write.runAsync(folders, status), (error: unknown) => error instanceof CheckpointFailedException
      && error.message === "The checkpoint before the discard couldn't be taken (HeldUp), so nothing was discarded.");

    assert.deepEqual([write.undo, write.checkpoint, await contentAsync("a.txt"), isThere("new.txt")], [UndoMode.None, null, "edited\n", true]);
  });

  test("puts a tracked file back to its staged content, keeping what is staged, and brings back a deleted one", async () => {
    await repository.writeAsync("b.txt", "b\n");
    await repository.runGitAsync(["add", "b.txt"]);
    await repository.runGitAsync(["commit", "--quiet", "-m", "b"]);
    await repository.runGitAsync(["rm", "--quiet", "b.txt"]);
    await repository.runGitAsync(["reset", "--quiet", "--", "b.txt"]);
    await repository.writeAsync("a.txt", "staged\n");
    await repository.runGitAsync(["add", "a.txt"]);
    await repository.writeAsync("a.txt", "staged and then edited\n");
    const { folders, status } = await readAsync();
    const write = new DiscardWriter(runner, ["a.txt", "b.txt"], none);

    write.refuse(status);
    await write.runAsync(folders, status);

    assert.deepEqual([await porcelainAsync(), await contentAsync("a.txt"), await contentAsync("b.txt")], ["M  a.txt\n", "staged\n", "b\n"]);
  });

  test("removes an untracked file and an untracked folder with what is in it, leaving ignored files and other changes", async () => {
    await repository.writeAsync(".gitignore", "*.log\n");
    await repository.runGitAsync(["add", ".gitignore"]);
    await repository.writeAsync("new.txt", "new\n");
    await mkdir(path.join(repository.folder, "folder"));
    await repository.writeAsync(path.join("folder", "inner.txt"), "inner\n");
    await repository.writeAsync(path.join("folder", "kept.log"), "ignored\n");
    await repository.writeAsync("a.txt", "edited\n");
    const { folders, status } = await readAsync();
    const paths = status.entries.filter(t => t.index === FileState.Untracked).map(t => t.path);
    const write = new DiscardWriter(runner, paths, none);

    write.refuse(status);
    await write.runAsync(folders, status);

    assert.deepEqual([paths.length > 0, isThere("new.txt"), isThere("folder", "inner.txt"), isThere("folder", "kept.log"), await porcelainAsync()],
      [true, false, false, true, "A  .gitignore\n M a.txt\n"]);
  });

  test("refuses, before anything runs, a path the status doesn't list, a staged-only one and a submodule", async () => {
    await repository.writeAsync("a.txt", "staged\n");
    await repository.runGitAsync(["add", "a.txt"]);
    const { status } = await readAsync();
    const submodule = new StatusEntry("module", undefined, null, undefined, FileState.Unmodified, FileState.Modified, null, new SubmoduleStatus(false, true, false), null, null);

    assert.throws(() => new DiscardWriter(runner, ["missing.txt"], none).refuse(status), refused("missing.txt"));
    assert.throws(() => new DiscardWriter(runner, ["a.txt"], none).refuse(status), refused("a.txt"));
    assert.throws(() => new DiscardWriter(runner, ["module"], none).refuse(withEntries(status, [submodule])), refused("module"));
    assert.equal(await contentAsync("a.txt"), "staged\n");
  });

  test("fails with git's output when git can't discard, for a tracked and an untracked path", async () => {
    await repository.writeAsync("a.txt", "edited\n");
    const { folders, status } = await readAsync();
    const gone = withEntries(status, [new StatusEntry("gone.txt", undefined, null, undefined, FileState.Untracked, FileState.Untracked, null, null, null, null)]);

    await assert.rejects(new DiscardWriter(runner, ["missing.txt"], none).runAsync(folders, status), failed("restore --worktree"));
    await repository.runGitAsync(["config", "core.bare", "true"]);
    await assert.rejects(new DiscardWriter(runner, ["gone.txt"], none).runAsync(folders, gone), failed("clean --force"));
  });
});
