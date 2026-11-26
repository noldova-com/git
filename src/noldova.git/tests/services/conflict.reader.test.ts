/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";
import { lstat, mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";

import { afterAll, afterEach, beforeAll, beforeEach, describe, test, vi } from "vitest";

import { ConflictKind, OperationKind } from "@noldova/git.protocol";

import { ConflictGoneException } from "../../src/exceptions/conflict-gone.exception.ts";
import { GitFailedException } from "../../src/exceptions/git-failed.exception.ts";
import type { RepositoryFolders } from "../../src/models/repository-folders.ts";
import { ConflictReader } from "../../src/services/conflict.reader.ts";
import { GitVersionReader } from "../../src/services/git-version.reader.ts";
import { ProgramRunner } from "../../src/services/program-runner.ts";
import { RepositoryReader } from "../../src/services/repository.reader.ts";
import { CleanUps } from "../fixtures/clean-ups.fixture.ts";
import { DesktopFixture } from "../fixtures/desktop.fixture.ts";
import { RepositoryFixture } from "../fixtures/repository.fixture.ts";
import { ScriptedRunnerFixture } from "../fixtures/scripted-runner.fixture.ts";

vi.mock(import("node:fs/promises"), { spy: true });

describe("ConflictReader", () => {
  let template: RepositoryFixture;
  let repository: RepositoryFixture;
  const cleanUps: CleanUps = new CleanUps();
  let supervisor: DesktopFixture;
  let runner: ProgramRunner;
  let repositories: RepositoryReader;

  beforeAll(async () => {
    template = await RepositoryFixture.createAsync();
    await template.writeAsync("a.txt", "one\ntwo\nthree\n");
    await template.writeAsync("b.txt", "b\n");
    await template.writeAsync("d.bin", Buffer.from([0, 1, 2, 10]));
    await template.runGitAsync(["add", "."]);
    await template.runGitAsync(["commit", "--quiet", "-m", "Base"]);
    await template.runGitAsync(["switch", "--quiet", "--create", "side"]);
    await template.writeAsync("a.txt", "one\nside\nthree\n");
    await template.runGitAsync(["rm", "--quiet", "b.txt"]);
    await template.writeAsync("c.txt", "side c\n");
    await template.writeAsync("d.bin", Buffer.from([0, 1, 3, 10]));
    await template.runGitAsync(["add", "."]);
    await template.runGitAsync(["commit", "--quiet", "-m", "Change on side"]);
    await template.runGitAsync(["switch", "--quiet", "main"]);
    await template.writeAsync("a.txt", "one\nmain\nthree\n");
    await template.writeAsync("b.txt", "b main\n");
    await template.writeAsync("c.txt", "main c\n");
    await template.writeAsync("d.bin", Buffer.from([0, 1, 4, 10]));
    await template.runGitAsync(["add", "."]);
    await template.runGitAsync(["commit", "--quiet", "-m", "Change on main"]);
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
  });

  afterEach(async () => {
    await cleanUps.runAsync();
  });

  const conflictAsync = (gitArguments: readonly string[]): Promise<string> => repository.runGitAsync(gitArguments).catch(() => "");
  const foldersAsync = (): Promise<RepositoryFolders> => repositories.readAsync(repository.folder);
  const readAsync = async (file: string, reader: ConflictReader = new ConflictReader(runner)) => (await reader.readAsync(await foldersAsync(), file)).toJson();
  const idOf = async (revision: string): Promise<string> => (await repository.runGitAsync(["rev-parse", revision])).trim();
  const labelsAsync = async (file: string = "a.txt"): Promise<unknown[]> => {
    const conflict = await readAsync(file);
    return [conflict["operation"], conflict["oursLabel"], conflict["theirsLabel"]];
  };
  const commitsAsync = async (file: string = "a.txt"): Promise<unknown[]> => {
    const conflict = await readAsync(file);
    return [conflict["oursCommit"], conflict["theirsCommit"]];
  };

  test("reads a modified/modified file's three stages, git's zdiff3 merge and the merge's side names and commits", async () => {
    const [main, side] = [await idOf("main"), await idOf("side")];
    await conflictAsync(["merge", "--quiet", "side"]);

    assert.deepEqual(await readAsync("a.txt"), {
      path: "a.txt",
      kind: ConflictKind.BothModified,
      operation: OperationKind.Merge,
      base: "one\ntwo\nthree\n",
      ours: "one\nmain\nthree\n",
      theirs: "one\nside\nthree\n",
      merged: "one\n<<<<<<< main\nmain\n||||||| base\ntwo\n=======\nside\n>>>>>>> side\nthree\n",
      oursLabel: "main",
      theirsLabel: "side",
      oursCommit: main,
      theirsCommit: side,
      binary: false,
      reused: false
    });
  });

  test("reads the three stages and both side names together, since each git run costs a process start", async () => {
    await conflictAsync(["merge", "--quiet", "side"]);
    const folders = await foldersAsync();
    const run = runner.runAsync.bind(runner);
    let running = 0;
    let most = 0;
    vi.spyOn(runner, "runAsync").mockImplementation(async t => {
      most = Math.max(most, ++running);
      try {
        return await run(t);
      } finally {
        running -= 1;
      }
    });

    await new ConflictReader(runner).readAsync(folders, "a.txt");

    assert.equal(most, 5);
  });

  test("merges an add/add file against an empty base", async () => {
    await conflictAsync(["merge", "--quiet", "side"]);

    const conflict = await readAsync("c.txt");

    assert.deepEqual([conflict["kind"], conflict["base"], conflict["ours"], conflict["theirs"], conflict["merged"]],
      [ConflictKind.BothAdded, null, "main c\n", "side c\n", "<<<<<<< main\nmain c\n||||||| base\n=======\nside c\n>>>>>>> side\n"]);
  });

  test("reads a file deleted on one side with its present stages and no merge", async () => {
    await conflictAsync(["merge", "--quiet", "side"]);

    const conflict = await readAsync("b.txt");

    assert.deepEqual([conflict["kind"], conflict["base"], conflict["ours"], conflict["theirs"], conflict["merged"], conflict["reused"]],
      [ConflictKind.DeletedByThem, "b\n", "b main\n", null, null, false]);
  });

  test("reads a binary file, a stage that isn't UTF-8 and a stage too large to take as text with no texts, so only sides are offered", async () => {
    await conflictAsync(["merge", "--quiet", "side"]);
    const binary = await readAsync("d.bin");
    assert.deepEqual([binary["kind"], binary["base"], binary["ours"], binary["theirs"], binary["merged"], binary["binary"]],
      [ConflictKind.BothModified, null, null, null, null, true]);
    await repository.runGitAsync(["merge", "--abort"]);
    await repository.writeAsync("a.txt", Buffer.from("one\nmain \xe9\nthree\n", "latin1"));
    await repository.runGitAsync(["commit", "--quiet", "-am", "Latin-1 on main"]);
    await conflictAsync(["merge", "--quiet", "side"]);
    assert.equal((await readAsync("a.txt"))["binary"], true);
    await repository.runGitAsync(["merge", "--abort"]);
    await repository.runGitAsync(["reset", "--quiet", "--hard", "HEAD~1"]);
    await conflictAsync(["merge", "--quiet", "side"]);
    const scripted = new ScriptedRunnerFixture(supervisor.context);
    scripted.truncating = "cat-file";

    assert.deepEqual([(await readAsync("a.txt", new ConflictReader(scripted)))["binary"], (await readAsync("a.txt"))["binary"]], [true, false]);
  });

  test("takes the worktree's text as the merge when it has no markers while the file is unmerged, as a recorded resolution leaves it", async () => {
    await conflictAsync(["merge", "--quiet", "side"]);
    await repository.writeAsync("a.txt", "one\nresolved\nthree\n");

    const reused = await readAsync("a.txt");

    assert.deepEqual([reused["merged"], reused["reused"]], ["one\nresolved\nthree\n", true]);
  });

  test("merges from the stages when the worktree file is gone, too large, not text or not a file", async () => {
    await conflictAsync(["merge", "--quiet", "side"]);
    const merged = "one\n<<<<<<< main\nmain\n||||||| base\ntwo\n=======\nside\n>>>>>>> side\nthree\n";
    await rm(path.join(repository.folder, "a.txt"));
    assert.deepEqual([(await readAsync("a.txt"))["merged"], (await readAsync("a.txt"))["reused"]], [merged, false]);
    await repository.writeAsync("a.txt", "x".repeat(4 * 1024 * 1024 + 1));
    assert.equal((await readAsync("a.txt"))["reused"], false);
    await repository.writeAsync("a.txt", Buffer.from([0, 1, 2]));
    assert.equal((await readAsync("a.txt"))["reused"], false);
    await rm(path.join(repository.folder, "a.txt"));
    await mkdir(path.join(repository.folder, "a.txt"));

    assert.deepEqual([(await readAsync("a.txt"))["merged"], (await readAsync("a.txt"))["reused"]], [merged, false]);
  });

  test("refuses a file that is resolved or never conflicted", async () => {
    await conflictAsync(["merge", "--quiet", "side"]);
    await repository.runGitAsync(["add", "a.txt"]);

    await assert.rejects(readAsync("a.txt"), (error: unknown) => error instanceof ConflictGoneException);
    await assert.rejects(readAsync("nothing.txt"), (error: unknown) => error instanceof ConflictGoneException);
  });

  test("names a cherry-pick's and a revert's incoming side by the commit", async () => {
    const side = await idOf("side");
    await conflictAsync(["cherry-pick", "side"]);
    assert.deepEqual(await labelsAsync(), [OperationKind.CherryPick, "main", `commit ${side.slice(0, 7)}`]);
    assert.deepEqual(await commitsAsync(), [await idOf("HEAD"), side]);
    await repository.runGitAsync(["cherry-pick", "--abort"]);
    await repository.writeAsync("a.txt", "one\nlater\nthree\n");
    await repository.runGitAsync(["commit", "--quiet", "-am", "Later on main"]);
    const main = await idOf("HEAD~1");

    await conflictAsync(["revert", "--no-edit", main]);

    assert.deepEqual(await labelsAsync(), [OperationKind.Revert, "main", `revert of ${main.slice(0, 7)}`]);
    assert.deepEqual(await commitsAsync(), [await idOf("HEAD"), main]);
  });

  test("names a rebase's sides as the branch it replays onto and your commit", async () => {
    const side = await idOf("side");
    await repository.runGitAsync(["switch", "--quiet", "side"]);

    await conflictAsync(["rebase", "main"]);

    assert.deepEqual(await labelsAsync(), [OperationKind.Rebase, "onto main", `your commit ${side.slice(0, 7)}`]);
    assert.deepEqual(await commitsAsync(), [await idOf("main"), side]);
  });

  test("falls back to current and incoming when a rebase's files don't name its sides", async () => {
    await conflictAsync(["merge", "--quiet", "side"]);
    await mkdir(path.join(repository.gitFolder, "rebase-merge"));
    await writeFile(path.join(repository.gitFolder, "rebase-merge", "head-name"), "refs/heads/main\n");

    assert.deepEqual(await labelsAsync(), [OperationKind.Rebase, "current", "incoming"]);
    assert.deepEqual(await commitsAsync(), [await idOf("main"), null]);
  });

  test("names a detached HEAD, a merged commit no branch points at, and a merge head that isn't an id", async () => {
    const side = await idOf("side");
    await repository.runGitAsync(["switch", "--quiet", "--detach", "main"]);
    await conflictAsync(["merge", "--quiet", "side"]);
    assert.deepEqual(await labelsAsync(), [OperationKind.Merge, "HEAD", "side"]);
    assert.deepEqual(await commitsAsync(), [await idOf("main"), side]);
    await repository.runGitAsync(["merge", "--abort"]);
    await repository.runGitAsync(["switch", "--quiet", "main"]);
    await repository.runGitAsync(["branch", "--quiet", "-D", "side"]);
    await conflictAsync(["merge", "--quiet", side]);
    assert.deepEqual(await labelsAsync(), [OperationKind.Merge, "main", side.slice(0, 7)]);

    await writeFile(path.join(repository.gitFolder, "MERGE_HEAD"), "not an id\n");

    assert.deepEqual(await labelsAsync(), [OperationKind.Merge, "main", "incoming"]);
    assert.deepEqual(await commitsAsync(), [await idOf("main"), null]);
  });

  test("names our side by HEAD's branch with no commit when that branch has none yet, and HEAD when that read fails too", async () => {
    const side = await idOf("side");
    await repository.runGitAsync(["switch", "--quiet", "--detach", "main"]);
    await conflictAsync(["merge", "--quiet", "side"]);
    const scripted = new ScriptedRunnerFixture(supervisor.context);
    scripted.failing = "rev-parse";
    const detached = await readAsync("a.txt", new ConflictReader(scripted));

    await writeFile(path.join(repository.gitFolder, "HEAD"), "ref: refs/heads/unborn\n");

    assert.deepEqual([await labelsAsync(), await commitsAsync()], [[OperationKind.Merge, "unborn", "side"], [null, side]]);
    assert.deepEqual([detached["oursLabel"], detached["oursCommit"]], ["HEAD", null]);
  });

  test("names the stash's side incoming when a conflict has no operation", async () => {
    await repository.writeAsync("a.txt", "one\nstashed\nthree\n");
    await repository.runGitAsync(["stash", "--quiet"]);
    await repository.writeAsync("a.txt", "one\ncommitted\nthree\n");
    await repository.runGitAsync(["commit", "--quiet", "-am", "Committed"]);

    await conflictAsync(["stash", "pop", "--quiet"]);

    assert.deepEqual(await labelsAsync(), [null, "main", "incoming"]);
    assert.deepEqual(await commitsAsync(), [await idOf("HEAD"), null]);
  });

  test("fails with git's errors as untrusted text when a read or the merge fails", async () => {
    await conflictAsync(["merge", "--quiet", "side"]);
    const scripted = new ScriptedRunnerFixture(supervisor.context);

    for (const [failing, code] of [["ls-files", 1], ["cat-file", 128], ["merge-file", 255], ["for-each-ref", 128]] as const) {
      scripted.failing = failing;
      scripted.failingCode = code;
      await assert.rejects(readAsync("a.txt", new ConflictReader(scripted)), (error: unknown) =>
        error instanceof GitFailedException && error.output?.text === "scripted failure\n", failing);
    }
    scripted.failing = null;
    for (const truncating of ["ls-files", "merge-file"]) {
      scripted.truncating = truncating;
      await assert.rejects(readAsync("a.txt", new ConflictReader(scripted)), (error: unknown) => error instanceof GitFailedException, truncating);
    }
  });

  test("fails when the worktree file is there but can't be read", async () => {
    await conflictAsync(["merge", "--quiet", "side"]);
    const folders = await foldersAsync();
    const denied = Object.assign(new Error("denied"), { code: "EACCES" });
    vi.mocked(lstat).mockRejectedValueOnce(denied);

    await assert.rejects(new ConflictReader(runner).readAsync(folders, "a.txt"), (error: unknown) => error === denied);
    assert.equal(String(vi.mocked(lstat).mock.calls.at(-1)?.[0]), path.join(folders.top, "a.txt"));
  });
});
