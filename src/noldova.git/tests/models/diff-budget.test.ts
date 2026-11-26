/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";

import { describe, test } from "vitest";

import { DiffFile, DiffHunk, DiffLine, FileChange, LineKind } from "@noldova/git.protocol";

import type { IJsonWritable } from "../../src/interfaces/i-json-writable.ts";
import { DiffBudget } from "../../src/models/diff-budget.ts";
import { ParsedDiff } from "../../src/models/parsed-diff.ts";

describe("DiffBudget", () => {
  const lines = [1, 2, 3].map(t => new DiffLine(LineKind.Added, null, t, `line ${t}`));
  const firstHunk = new DiffHunk(0, 0, 1, 3, "", lines);
  const hunks = [firstHunk, new DiffHunk(0, 0, 4, 3, "next", lines)];
  const file = new DiffFile("a.txt", undefined, "a.txt", undefined, FileChange.Added, null, "100644", false, null, hunks, false);
  const sizeOf = (value: IJsonWritable): number => Buffer.byteLength(JSON.stringify(value.toJson()));
  const BASE = sizeOf(new DiffFile("a.txt", undefined, "a.txt", undefined, FileChange.Added, null, "100644", false, null, [], false));
  const HUNK = sizeOf(new DiffHunk(0, 0, 1, 3, "", [])) + 1;
  const LINE = sizeOf(new DiffLine(LineKind.Added, null, 1, "line 1")) + 1;
  const cut = (hunk: DiffHunk, count: number): DiffHunk => new DiffHunk(hunk.oldStart, hunk.oldCount, hunk.newStart, hunk.newCount, hunk.header, hunk.lines.slice(0, count));
  const truncated = (kept: readonly DiffHunk[]): DiffFile => new DiffFile("a.txt", undefined, "a.txt", undefined, FileChange.Added, null, "100644", false, null, kept, true);

  test("adds a file that fits whole, counting its encoded JSON with a separator for each hunk and line, above the real size", () => {
    const budget = new DiffBudget(100_000, 1_000_000);

    budget.add(file);

    const diff = budget.toDiff();
    assert.equal(diff.files[0], file);
    assert.equal(diff.totalBytes, BASE + HUNK + sizeOf(new DiffHunk(0, 0, 4, 3, "next", [])) + 1 + 6 * LINE);
    assert.ok(diff.totalBytes >= sizeOf(file));
    assert.deepEqual([diff.omittedFiles, diff.truncated, budget.isFull], [0, false, false]);
  });

  test("cuts a file's lines or hunks at its own limit and goes on with later files", () => {
    const budget = new DiffBudget(BASE + HUNK + 2 * LINE, 1_000_000);

    budget.add(file);
    budget.add(new DiffFile("b.bin", undefined, "b.bin", undefined, FileChange.Modified, "100644", "100644", true, null, [], false));

    const diff = budget.toDiff();
    assert.deepEqual(diff.files[0], truncated([cut(firstHunk, 2)]));
    assert.equal(diff.files[1]?.path, "b.bin");
    assert.deepEqual([diff.omittedFiles, diff.truncated, budget.isFull], [0, false, false]);

    const atHunk = new DiffBudget(BASE + HUNK + 3 * LINE + HUNK, 1_000_000);
    atHunk.add(file);
    assert.deepEqual(atHunk.toDiff().files[0], truncated([firstHunk]));
  });

  test("keeps a renamed file's old path and similarity when it cuts the file's lines", () => {
    const renamed = new DiffFile("b.txt", undefined, "a.txt", undefined, FileChange.Renamed, "100644", "100644", false, null, hunks, false, 87);
    const budget = new DiffBudget(sizeOf(new DiffFile("b.txt", undefined, "a.txt", undefined, FileChange.Renamed, "100644", "100644", false, null, [], false, 87)) + HUNK + LINE, 1_000_000);

    budget.add(renamed);

    const kept = budget.toDiff().files[0];
    assert.deepEqual([kept?.oldPath, kept?.similarity, kept?.truncated], ["a.txt", 87, true]);
  });

  test("fills at the whole diff's limit, leaving out the later files", () => {
    const budget = new DiffBudget(100_000, BASE + HUNK + LINE);

    budget.add(file);
    budget.add(file);

    const diff = budget.toDiff();
    assert.deepEqual(diff.files, [truncated([cut(firstHunk, 1)])]);
    assert.deepEqual([diff.totalBytes, diff.omittedFiles, diff.truncated, budget.isFull], [BASE + HUNK + LINE, 1, true, true]);
  });

  test("leaves out a file whose own fields don't fit, and counts the files and the cut that a parsed output reports", () => {
    const budget = new DiffBudget(BASE - 1, 1_000_000);

    budget.add(file);
    budget.addParsed(new ParsedDiff([], 2, false));

    assert.deepEqual(budget.toDiff().toJson(), { files: [], totalBytes: 0, omittedFiles: 3, truncated: true, totals: null });
    const parsed = new DiffBudget(100_000, 1_000_000);
    parsed.addParsed(new ParsedDiff([file], 0, false));
    assert.equal(parsed.toDiff().truncated, false);
    parsed.addParsed(new ParsedDiff([], 0, true));
    assert.deepEqual(parsed.toDiff().files, [file]);
    assert.equal(parsed.toDiff().truncated, true);
  });
});
