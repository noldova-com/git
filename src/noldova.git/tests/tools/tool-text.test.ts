/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */
import assert from "node:assert/strict";

import { describe, test } from "vitest";

import { DiffFile, FileChange, FileState, GitBranches, GitCommit, GitDiff, GitLog, GitStatus, StatusEntry } from "@noldova/git.protocol";

import { ToolText } from "../../src/tools/tool-text.ts";

describe("ToolText", () => {
  const limit = 250_000;
  const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);
  const parsed = (text: string | null): Record<string, unknown> => {
    assert.ok(text !== null);
    assert.ok(Buffer.byteLength(text) <= limit);
    const value: unknown = JSON.parse(text);
    assert.ok(isRecord(value));
    return value;
  };
  const lengthOf = (value: unknown): number => (Array.isArray(value) ? value.length : -1);

  test("keeps a whole read that fits, and else the most items that fit, or none", () => {
    const commits = Array.from({ length: 400 }, (_, index) => new GitCommit(String(index).padStart(40, "a"), [], "Noldova Test <test@example.invalid>",
      "2026-11-06T12:00:00Z", "s".repeat(998)));
    const textOf = (kept: number): string => JSON.stringify(new GitLog(commits.slice(0, kept), true).toJson());

    assert.equal(ToolText.ofLog(new GitLog(commits.slice(0, 3), false)), JSON.stringify(new GitLog(commits.slice(0, 3), false).toJson()));
    const cut = parsed(ToolText.ofLog(new GitLog(commits, false)));
    const kept = lengthOf(cut["commits"]);
    assert.ok(kept > 0 && kept < 400);
    assert.deepEqual([JSON.stringify(cut), Buffer.byteLength(textOf(kept + 1)) > limit], [textOf(kept), true]);
    assert.equal(ToolText.ofBranches(new GitBranches("c".repeat(limit), [], [], [])), null);
  });

  test("cuts a status's entries, a diff's files and a log's commits from the end, and marks each cut", () => {
    const entries = Array.from({ length: 4_000 }, (_, index) =>
      new StatusEntry(`${"d".repeat(60)}/${index}.txt`, undefined, null, undefined, FileState.Modified, FileState.Unmodified, null, null, null, null));
    const status = parsed(ToolText.ofStatus(new GitStatus("main", null, null, entries, false, "f1", null, null)));
    assert.ok(lengthOf(status["entries"]) > 0 && lengthOf(status["entries"]) < 4_000);
    assert.equal(status["truncated"], true);
    assert.equal(parsed(ToolText.ofStatus(new GitStatus("main", null, null, entries.slice(0, 2), false, "f1", null, null)))["truncated"], false);

    const files = Array.from({ length: 3_000 }, (_, index) =>
      new DiffFile(`${"d".repeat(60)}/${index}.txt`, undefined, `${"d".repeat(60)}/${index}.txt`, undefined, FileChange.Modified, "100644", "100644", false, null, [], false));
    const diff = parsed(ToolText.ofDiff(new GitDiff(files, 10, 2, true)));
    const kept = lengthOf(diff["files"]);
    assert.ok(kept > 0 && kept < 3_000);
    assert.deepEqual([diff["truncated"], diff["omittedFiles"]], [true, 2 + 3_000 - kept]);

    const commits = Array.from({ length: 500 }, () => new GitCommit("a".repeat(40), [], "Noldova Test <test@example.invalid>", "2026-11-06T12:00:00Z", "s".repeat(1_000)));
    const log = parsed(ToolText.ofLog(new GitLog(commits, false)));
    assert.ok(lengthOf(log["commits"]) > 0 && lengthOf(log["commits"]) < 500);
    assert.equal(log["truncated"], true);
  });

  test("cuts the remotes' branches first, then the local ones, marking the cut, and answers null when even the current branch can't fit", () => {
    const names = (prefix: string): string[] => Array.from({ length: 20_000 }, (_, index) => `${prefix}/branch-${index}`);

    const few = parsed(ToolText.ofBranches(new GitBranches("main", ["main"], ["origin"], ["origin/main"])));
    assert.equal(few["truncated"], false);
    const remote = parsed(ToolText.ofBranches(new GitBranches("main", ["main"], ["origin"], names("origin"))));
    assert.deepEqual([lengthOf(remote["branches"]), remote["truncated"]], [1, true]);
    assert.ok(lengthOf(remote["remoteBranches"]) > 0);
    const local = parsed(ToolText.ofBranches(new GitBranches("main", names("local"), ["origin"], names("origin"))));
    assert.deepEqual([lengthOf(local["remoteBranches"]), local["truncated"]], [0, true]);
    assert.ok(lengthOf(local["branches"]) > 0 && lengthOf(local["branches"]) < 20_000);
    assert.equal(ToolText.ofBranches(new GitBranches("c".repeat(limit), [], [], [])), null);
  });
});
