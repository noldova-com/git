/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";
import { access, mkdir, symlink, unlink, writeFile } from "node:fs/promises";
import path from "node:path";

import { afterAll, afterEach, beforeAll, beforeEach, describe, test } from "vitest";

import { PermissionDetailKind } from "@noldova/desktop.runtime";
import { FailureCode, GitCode, GitNames, type GitJournalEntry, UndoMode } from "@noldova/git.protocol";

import { GitFailedException } from "../../src/exceptions/git-failed.exception.ts";
import { NothingToStashException } from "../../src/exceptions/nothing-to-stash.exception.ts";
import { UndoMovedException } from "../../src/exceptions/undo-moved.exception.ts";
import type { RepositoryFolders } from "../../src/models/repository-folders.ts";
import { CheckpointStore } from "../../src/services/checkpoint-store.ts";
import { GitVersionReader } from "../../src/services/git-version.reader.ts";
import { Journal } from "../../src/services/journal.ts";
import { ProgramRunner } from "../../src/services/program-runner.ts";
import { RefSnapshotReader } from "../../src/services/ref-snapshot.reader.ts";
import { RepositoryReader } from "../../src/services/repository.reader.ts";
import { StashWriter } from "../../src/services/stash.writer.ts";
import { StatusReader } from "../../src/services/status.reader.ts";
import { UndoWriter } from "../../src/services/undo.writer.ts";
import { WriteRunner } from "../../src/services/write.runner.ts";
import { CleanUps } from "../fixtures/clean-ups.fixture.ts";
import { DesktopFixture } from "../fixtures/desktop.fixture.ts";
import { ScriptedRunnerFixture } from "../fixtures/scripted-runner.fixture.ts";
import { RepositoryFixture } from "../fixtures/repository.fixture.ts";

describe("StashWriter", () => {
  let template: RepositoryFixture;
  let repository: RepositoryFixture;
  const cleanUps: CleanUps = new CleanUps();
  let supervisor: DesktopFixture;
  let runner: ProgramRunner;
  let statuses: StatusReader;
  let snapshots: RefSnapshotReader;
  let journal: Journal;
  let writes: WriteRunner;
  let folders: RepositoryFolders;
  const store: CheckpointStore = new CheckpointStore(() => null);

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
    statuses = new StatusReader(runner);
    snapshots = new RefSnapshotReader(runner);
    journal = new Journal();
    writes = new WriteRunner(statuses, snapshots, journal, () => undefined, () => undefined);
    folders = await new RepositoryReader(runner, new GitVersionReader(runner)).readAsync(repository.folder);
  });

  afterEach(async () => {
    await cleanUps.runAsync();
  });

  const statusOf = async (): Promise<string> => await repository.runGitAsync(["status", "--porcelain=v1", "--untracked-files=all"]);
  const stashesOf = async (): Promise<readonly string[]> =>
    (await repository.runGitAsync(["stash", "list", "--format=%s"])).split("\n").filter(t => t.length > 0);
  const stashIdOf = async (): Promise<string> => (await repository.runGitAsync(["rev-parse", "refs/stash"])).trim();
  const fingerprintAsync = async (): Promise<string> => (await statuses.readAsync(folders)).fingerprint;
  const stashAsync = async (message: string | null, includeUntracked: boolean): Promise<GitJournalEntry> => {
    await writes.runAsync(folders, await fingerprintAsync(), new StashWriter(runner, message, includeUntracked), null);
    const entry = journal.read(folders.commonGitFolder).entries.at(-1);
    assert.ok(entry !== undefined);
    return entry;
  };
  const undoAsync = async (entry: GitJournalEntry): Promise<void> =>
    await writes.runAsync(folders, await fingerprintAsync(), new UndoWriter(runner, snapshots, journal, store, entry.id), null);
  const changeAsync = async (): Promise<void> => {
    await repository.writeAsync("a.txt", "staged\n");
    await repository.runGitAsync(["add", "a.txt"]);
    await repository.writeAsync("a.txt", "staged and more\n");
    await repository.writeAsync("new.txt", "new\n");
  };

  test("stashes the changes with their message, the untracked file only when asked, never asking, and keeps each stash's commit for its undo", async () => {
    await changeAsync();

    const tracked = await stashAsync("Half-done lanes", false);
    const afterTracked = [await statusOf(), await stashesOf(), tracked.checkpoint === await stashIdOf()];
    const untracked = await stashAsync(null, true);

    assert.deepEqual(afterTracked, ["?? new.txt\n", ["On main: Half-done lanes"], true]);
    assert.deepEqual([await statusOf(), (await stashesOf()).length, untracked.method, untracked.undo, untracked.checkpoint, untracked.paths, tracked.undo],
      ["", 2, GitNames.stashMethod, UndoMode.Stash, await stashIdOf(), [], UndoMode.Stash]);
    assert.equal(await new StashWriter(runner, null, false).requestAsync(), null);
  });

  test("refuses a folder without changes, or with only untracked files while they are left out, without running git stash", async () => {
    const refused = (error: unknown): boolean => {
      assert.ok(error instanceof NothingToStashException);
      assert.deepEqual([error.code, error.gitCode, error.message], [FailureCode.Git, GitCode.NothingToStash, "There are no changes to stash."]);
      return true;
    };

    await assert.rejects(stashAsync(null, false), refused);
    await repository.writeAsync("new.txt", "new\n");
    await assert.rejects(stashAsync(null, false), refused);

    assert.deepEqual([await stashesOf(), journal.read(folders.commonGitFolder).entries], [[], []]);
  });

  test("refuses a folder whose only change is inside a submodule, and journals nothing and keeps the older stash when git makes no stash", async () => {
    const source = path.join(repository.root, "library");
    await repository.runGitAsync(["init", "--quiet", source]);
    await writeFile(path.join(source, "library.txt"), "a\n");
    await repository.runGitAsync(["-C", source, "add", "library.txt"]);
    await repository.runGitAsync(["-C", source, "commit", "--quiet", "-m", "library"]);
    await repository.runGitAsync(["-c", "protocol.file.allow=always", "submodule", "--quiet", "add", source, "library"]);
    await repository.runGitAsync(["commit", "--quiet", "-m", "Add the library"]);
    await repository.writeAsync(path.join("library", "inside.txt"), "inside\n");
    const refused = (error: unknown): boolean => error instanceof NothingToStashException;
    const runAsync = async (): Promise<void> => await new StashWriter(runner, null, true).runAsync(folders, await statuses.readAsync(folders));

    await assert.rejects(stashAsync(null, true), refused);
    await assert.rejects(runAsync(), refused);
    const withoutStash = await stashesOf();
    await repository.writeAsync("a.txt", "older\n");
    await repository.runGitAsync(["stash", "push", "--quiet"]);
    const older = await stashIdOf();
    await assert.rejects(runAsync(), refused);

    assert.deepEqual([withoutStash, (await stashesOf()).length, await stashIdOf(), journal.read(folders.commonGitFolder).entries], [[], 1, older, []]);
    await access(path.join(repository.folder, "library", "inside.txt"));
  });

  test("fails with git's own words when git can't save the stash, leaving the changes and no stash", async () => {
    await changeAsync();
    await repository.writeAsync(".git/refs/stash.lock", "");
    const before = await statusOf();

    await assert.rejects(stashAsync(null, true), (error: unknown) =>
      error instanceof GitFailedException && error.command === "stash" && (error.output?.text ?? "").includes("Cannot save the current status"));

    assert.deepEqual([await statusOf(), await stashesOf(), journal.read(folders.commonGitFolder).entries], [before, [], []]);
  });

  test("fails as git's failure when another git holds the index, though git 2.39 says nothing then, leaving the changes and no stash", async () => {
    await changeAsync();
    await repository.writeAsync(".git/index.lock", "");
    const before = await statusOf();

    await assert.rejects(stashAsync(null, true), (error: unknown) => error instanceof GitFailedException && error.command === "stash");

    assert.deepEqual([await statusOf(), await stashesOf(), journal.read(folders.commonGitFolder).entries], [before, [], []]);
  });

  test("asks an agent's undo of a stash naming the stash's commit it pops", async () => {
    await changeAsync();
    const entry = await stashAsync(null, true);

    const request = await new UndoWriter(runner, snapshots, journal, store, entry.id).requestAsync(folders, await statuses.readAsync(folders), null);

    assert.deepEqual(request?.details, [{ label: "Stash", kind: PermissionDetailKind.Code, value: await stashIdOf() }]);
  });

  test("undoes a stash by popping it back with its index: the staged change staged, the rest changed and the untracked file back", async () => {
    await changeAsync();
    const before = await statusOf();
    const entry = await stashAsync(null, true);

    await undoAsync(entry);

    assert.deepEqual([await statusOf(), await stashesOf(), journal.read(folders.commonGitFolder).entries.map(t => t.method)], [before, [], [GitNames.undoMethod]]);
    assert.ok((await repository.runGitAsync(["diff", "--cached", "--", "a.txt"])).includes("+staged"));
  });

  test("keeps the stash and changes nothing when an ignored file is at or in the way of an untracked file it holds, and pops it once they are gone", async () => {
    await mkdir(path.join(repository.folder, "lib"));
    await repository.writeAsync(path.join("lib", "kept.ts"), "kept\n");
    await repository.runGitAsync(["add", "lib"]);
    await repository.runGitAsync(["commit", "--quiet", "-m", "Add the library"]);
    await changeAsync();
    await mkdir(path.join(repository.folder, "notes"));
    await repository.writeAsync(path.join("notes", "todo.txt"), "todo\n");
    await repository.writeAsync(path.join("lib", "new.ts"), "new\n");
    const before = await statusOf();
    const entry = await stashAsync(null, true);
    const stash = await stashIdOf();
    const exclude = path.join(repository.gitFolder, "info", "exclude");
    await mkdir(path.dirname(exclude), { recursive: true });
    await writeFile(exclude, "new.txt\nnotes\n");
    const moved = (error: unknown): boolean => error instanceof UndoMovedException;

    await repository.writeAsync("new.txt", "ignored\n");
    await assert.rejects(undoAsync(entry), moved);
    const atPath = [await statusOf(), await stashIdOf()];
    await unlink(path.join(repository.folder, "new.txt"));
    await repository.writeAsync("notes", "a file where the folder goes\n");
    await assert.rejects(undoAsync(entry), moved);
    const inTheWay = [await statusOf(), await stashIdOf()];
    await unlink(path.join(repository.folder, "notes"));
    await writeFile(exclude, "");
    await undoAsync(entry);

    assert.deepEqual([atPath, inTheWay], [["", stash], ["", stash]]);
    assert.deepEqual([await statusOf(), await stashesOf()], [before, []]);
  });

  test("keeps the stash and changes nothing when an ignored link whose target is gone is at or in the way of an untracked file it holds", async () => {
    await changeAsync();
    await mkdir(path.join(repository.folder, "notes"));
    await repository.writeAsync(path.join("notes", "todo.txt"), "todo\n");
    const entry = await stashAsync(null, true);
    const stash = await stashIdOf();
    const exclude = path.join(repository.gitFolder, "info", "exclude");
    await mkdir(path.dirname(exclude), { recursive: true });
    await writeFile(exclude, "new.txt\nnotes\n");
    const moved = (error: unknown): boolean => error instanceof UndoMovedException;

    await symlink(path.join(repository.root, "gone"), path.join(repository.folder, "new.txt"), "junction");
    await assert.rejects(undoAsync(entry), moved);
    const atPath = [await statusOf(), await stashIdOf()];
    await unlink(path.join(repository.folder, "new.txt"));
    await symlink(path.join(repository.root, "gone"), path.join(repository.folder, "notes"), "junction");
    await assert.rejects(undoAsync(entry), moved);

    assert.deepEqual([atPath, [await statusOf(), await stashIdOf()]], [["", stash], ["", stash]]);
  });

  const refusesListingAsync = async (failing: string | null, truncating: string | null): Promise<void> => {
    await changeAsync();
    const entry = await stashAsync(null, true);
    const stash = await stashIdOf();
    const entries = journal.read(folders.commonGitFolder).entries;
    const scripted = new ScriptedRunnerFixture(supervisor.context);
    scripted.failing = failing;
    scripted.truncating = truncating;

    const undo = writes.runAsync(folders, await fingerprintAsync(), new UndoWriter(scripted, snapshots, journal, store, entry.id), null);

    await assert.rejects(undo, (error: unknown) => error instanceof UndoMovedException);
    assert.deepEqual([await statusOf(), await stashIdOf(), journal.read(folders.commonGitFolder).entries], ["", stash, entries]);
  };

  test("refuses as stale, keeps the stash and journals nothing when the listing of its untracked files fails", async () => {
    await refusesListingAsync("ls-tree", null);
  });

  test("refuses as stale, keeps the stash and journals nothing when the listing of its untracked files is cut short", async () => {
    await refusesListingAsync(null, "ls-tree");
  });

  test("pops a stash without untracked files back, which has no third parent to list", async () => {
    await repository.writeAsync("a.txt", "staged\n");
    await repository.runGitAsync(["add", "a.txt"]);
    await repository.writeAsync("a.txt", "staged and more\n");
    const before = await statusOf();
    const entry = await stashAsync(null, false);

    await undoAsync(entry);

    assert.deepEqual([await statusOf(), await stashesOf()], [before, []]);
  });

  test("keeps the stash and changes nothing when it couldn't pop cleanly: changes in the folder, HEAD moved, or a newer stash", async () => {
    await changeAsync();
    const entry = await stashAsync(null, true);
    const stash = await stashIdOf();
    const moved = (error: unknown): boolean => {
      assert.ok(error instanceof UndoMovedException);
      return true;
    };

    await repository.writeAsync("a.txt", "in the way\n");
    await assert.rejects(undoAsync(entry), moved);
    const dirty = [await statusOf(), await stashIdOf()];
    await repository.runGitAsync(["commit", "--quiet", "-am", "Move HEAD"]);
    await assert.rejects(undoAsync(entry), moved);
    const headMoved = [await statusOf(), await stashIdOf()];
    await repository.runGitAsync(["reset", "--quiet", "--hard", "HEAD~1"]);
    await repository.writeAsync("other.txt", "other\n");
    await repository.runGitAsync(["stash", "push", "--quiet", "--include-untracked"]);
    await assert.rejects(undoAsync(entry), moved);

    assert.deepEqual([dirty, headMoved], [[" M a.txt\n", stash], ["", stash]]);
    assert.deepEqual([await statusOf(), (await stashesOf()).length, journal.find(folders.commonGitFolder, entry.id)?.id], ["", 2, entry.id]);
  });
});
