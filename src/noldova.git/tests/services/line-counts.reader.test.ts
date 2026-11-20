/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */
import assert from "node:assert/strict";
import { chmod, rm } from "node:fs/promises";
import path from "node:path";

import { afterAll, afterEach, beforeAll, beforeEach, describe, test } from "vitest";

import { FailureCode, FileState, GitCode, StatusEntry, UntrustedSource } from "@noldova/git.protocol";

import { GitFailedException } from "../../src/exceptions/git-failed.exception.ts";
import { LineCountsReader } from "../../src/services/line-counts.reader.ts";
import { CleanUps } from "../fixtures/clean-ups.fixture.ts";
import { DesktopFixture } from "../fixtures/desktop.fixture.ts";
import { RepositoryFixture } from "../fixtures/repository.fixture.ts";
import { ScriptedRunnerFixture } from "../fixtures/scripted-runner.fixture.ts";

describe("LineCountsReader", () => {
  let template: RepositoryFixture;
  let repository: RepositoryFixture;
  const cleanUps: CleanUps = new CleanUps();
  let supervisor: DesktopFixture;
  let runner: ScriptedRunnerFixture;
  let reader: LineCountsReader;

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
    reader = new LineCountsReader(runner);
  });

  afterEach(async () => {
    await cleanUps.runAsync();
  });

  const entry = (file: string, index: FileState, worktree: FileState, pathBytes?: string): StatusEntry =>
    new StatusEntry(file, pathBytes, null, undefined, index, worktree, null, null, null, null);
  const counts = (entries: readonly StatusEntry[]): unknown[] => entries.map(t => [t.indexCounts?.toJson() ?? null, t.worktreeCounts?.toJson() ?? null]);
  const unreadable = { name: "UnreadableOutputException", code: FailureCode.Git, gitCode: GitCode.UnreadableOutput, message: "git diff --numstat printed line counts that the module can't read." };

  test("reads numstat's counts, a binary file's as none, and a staged rename under its new path", async () => {
    await repository.writeAsync("old.txt", "old\n");
    await repository.writeAsync("bin.dat", Buffer.from([0, 1, 2]));
    await repository.runGitAsync(["add", "old.txt", "bin.dat"]);
    await repository.runGitAsync(["commit", "--quiet", "-m", "More"]);
    await repository.writeAsync("a.txt", "b\nc\n");
    await repository.writeAsync("bin.dat", Buffer.from([0, 3, 4]));
    await repository.runGitAsync(["mv", "old.txt", "new.txt"]);

    const entries = await reader.countAsync(repository.folder, [
      entry("a.txt", FileState.Unmodified, FileState.Modified),
      entry("bin.dat", FileState.Unmodified, FileState.Modified),
      new StatusEntry("new.txt", undefined, "old.txt", undefined, FileState.Renamed, FileState.Unmodified, null, null, null, null)
    ], []);

    assert.deepEqual(counts(entries), [[null, { added: 2, removed: 1 }], [null, null], [{ added: 0, removed: 0 }, null]]);
  });

  test("reads a last record that ends without its NUL", async () => {
    runner.answering = ["--numstat", "1\t2\tlast.txt"];

    assert.deepEqual(counts(await reader.countAsync(repository.folder, [entry("last.txt", FileState.Modified, FileState.Unmodified)], [])), [[{ added: 1, removed: 2 }, null]]);
  });

  test("fails as unreadable on a record without both counts, on counts that aren't numbers and on a rename without its paths", async () => {
    for (const output of ["a.txt\0", "1\ta.txt\0", "x\t1\ta.txt\0", "1\t-\ta.txt\0", "1\t1\t\0old.txt\0"]) {
      runner.answering = ["--numstat", output];
      await assert.rejects(reader.countAsync(repository.folder, [entry("a.txt", FileState.Modified, FileState.Unmodified)], []), unreadable, JSON.stringify(output));
    }
  });

  test("counts only the sides that changed, and an untracked text file's own lines", async () => {
    await repository.writeAsync("a.txt", "one\ntwo\n");
    await repository.runGitAsync(["add", "a.txt"]);
    await repository.writeAsync("a.txt", "one\n");
    await repository.writeAsync("lines.txt", "x\ny");
    await repository.writeAsync("ended.txt", "x\n");
    await repository.writeAsync("empty.txt", "");
    await repository.writeAsync("binary.txt", Buffer.from([0x61, 0, 0x62]));

    const entries = await reader.countAsync(repository.folder, [
      entry("a.txt", FileState.Modified, FileState.Modified),
      entry("lines.txt", FileState.Untracked, FileState.Untracked),
      entry("ended.txt", FileState.Untracked, FileState.Untracked),
      entry("empty.txt", FileState.Untracked, FileState.Untracked),
      entry("binary.txt", FileState.Untracked, FileState.Untracked),
      entry("ignored.log", FileState.Ignored, FileState.Ignored)
    ], []);

    assert.deepEqual(counts(entries), [
      [{ added: 2, removed: 1 }, { added: 0, removed: 1 }],
      [null, { added: 2, removed: 0 }],
      [null, { added: 1, removed: 0 }],
      [null, { added: 0, removed: 0 }],
      [null, null],
      [null, null]
    ]);
  });

  test("runs no diff when no side changed, and counts none for a path that isn't UTF-8, a folder, a file that went away or one past 1 MiB", async () => {
    await repository.writeAsync("large.txt", "x\n".repeat(512 * 1024 + 1));
    const commands: string[] = [];
    runner.starting = command => commands.push(command);

    const entries = await reader.countAsync(repository.folder, [
      entry("caf\u00e9.txt", FileState.Untracked, FileState.Untracked, Buffer.from([0x63, 0x61, 0x66, 0xe9]).toString("base64")),
      entry(".git", FileState.Untracked, FileState.Untracked),
      entry("gone.txt", FileState.Untracked, FileState.Untracked),
      entry("large.txt", FileState.Untracked, FileState.Untracked)
    ], []);

    assert.deepEqual(counts(entries), [[null, null], [null, null], [null, null], [null, null]]);
    assert.deepEqual(commands, []);
  });

  test("fails on an untracked path it can't even ask the file system about, rather than counting none", async () => {
    await assert.rejects(reader.countAsync(repository.folder, [entry("a\0b.txt", FileState.Untracked, FileState.Untracked)], []), { code: "ERR_INVALID_ARG_VALUE" });
  });

  test("stops counting untracked files once it has read 32 MiB", async () => {
    await repository.writeAsync("mebibyte.txt", "x\n".repeat(512 * 1024));

    const entries = await reader.countAsync(repository.folder, Array.from({ length: 33 }, () => entry("mebibyte.txt", FileState.Untracked, FileState.Untracked)), []);

    assert.deepEqual(entries.map(t => t.worktreeCounts?.added ?? null), [...Array.from({ length: 32 }, () => 512 * 1024), null]);
  });

  test("counts none when numstat's output was cut, and fails with git's errors marked untrusted when it fails", async () => {
    await repository.writeAsync("a.txt", "changed\n");
    await repository.runGitAsync(["add", "a.txt"]);
    await repository.writeAsync("a.txt", "again\n");
    const changed = [entry("a.txt", FileState.Modified, FileState.Modified)];
    runner.truncating = "--numstat";

    assert.deepEqual(counts(await reader.countAsync(repository.folder, changed, [])), [[null, null]]);

    runner.truncating = null;
    const staged = (await repository.runGitAsync(["rev-parse", ":a.txt"])).trim();
    const object = path.join(repository.gitFolder, "objects", staged.slice(0, 2), staged.slice(2));
    await chmod(object, 0o644);
    await rm(object);
    await assert.rejects(reader.countAsync(repository.folder, changed, []), (error: unknown) => {
      assert.ok(error instanceof GitFailedException);
      assert.deepEqual([error.code, error.message, error.output?.source], [FailureCode.Unavailable, "git diff --numstat failed; its output comes with the failure as untrusted text.",
        UntrustedSource.Repository]);
      assert.match(error.output?.text ?? "", new RegExp(staged, "v"));
      return true;
    });
  });
});
