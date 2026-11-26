/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";

import { describe, test } from "vitest";

import { ConflictKind, FailureCode, FileState, GitCode, type JsonObject } from "@noldova/git.protocol";

import type { ParsedStatus } from "../../src/models/parsed-status.ts";
import { StatusParser } from "../../src/services/status.parser.ts";

interface IUnreadableFailure {
  readonly name: string;
  readonly code: FailureCode;
  readonly gitCode: GitCode;
  readonly message: string;
}

describe("StatusParser", () => {
  const HEAD = "0123456789abcdef0123456789abcdef01234567";
  const ID = "89abcdef0123456789abcdef0123456789abcdef";
  const output = (...records: readonly string[]): Buffer => Buffer.from(records.map(t => `${t}\0`).join(""));
  const json = (parsed: ParsedStatus): JsonObject => parsed.toStatus(parsed.entries, "f", null, null, 0, null, null).toJson();
  const unreadable = (part: string): IUnreadableFailure =>
    ({ name: "UnreadableOutputException", code: FailureCode.Git, gitCode: GitCode.UnreadableOutput, message: `git status printed ${part} that the module can't read.` });

  test("reads the branch, HEAD, the upstream and every kind of entry", () => {
    const status = StatusParser.parse(output(
      `# branch.oid ${HEAD}`,
      "# branch.head feature/login",
      "# branch.upstream origin/feature/login",
      "# branch.ab +2 -1",
      "# stash 3",
      `1 .M N... 100644 100644 100644 ${ID} ${ID} a file.txt`,
      `1 A. N... 000000 100644 100644 ${HEAD} ${ID} added.txt`,
      `1 T. N... 100644 120000 120000 ${ID} ${ID} link`,
      `1 D. N... 100644 000000 000000 ${ID} ${HEAD} gone.txt`,
      `2 R. N... 100644 100644 100644 ${ID} ${ID} R100 new name.txt`,
      "old name.txt",
      `2 .C N... 100644 100644 100644 ${ID} ${ID} C75 copy.txt`,
      "source.txt",
      `u UU N... 100644 100644 100644 100644 ${ID} ${ID} ${ID} both.txt`,
      `1 .M SCMU 160000 160000 160000 ${ID} ${ID} module`,
      "? new dir/untracked.txt",
      "! build/out.txt"
    ), false, 100);

    assert.deepEqual(json(status), {
      branch: "feature/login",
      head: HEAD,
      upstream: { name: "origin/feature/login", ahead: 2, behind: 1, gone: false, id: null },
      entries: [
        { path: "a file.txt", originalPath: null, index: FileState.Unmodified, worktree: FileState.Modified, conflict: null, submodule: null, indexCounts: null, worktreeCounts: null },
        { path: "added.txt", originalPath: null, index: FileState.Added, worktree: FileState.Unmodified, conflict: null, submodule: null, indexCounts: null, worktreeCounts: null },
        { path: "link", originalPath: null, index: FileState.TypeChanged, worktree: FileState.Unmodified, conflict: null, submodule: null, indexCounts: null, worktreeCounts: null },
        { path: "gone.txt", originalPath: null, index: FileState.Deleted, worktree: FileState.Unmodified, conflict: null, submodule: null, indexCounts: null, worktreeCounts: null },
        { path: "new name.txt", originalPath: "old name.txt", index: FileState.Renamed, worktree: FileState.Unmodified, conflict: null, submodule: null, indexCounts: null, worktreeCounts: null },
        { path: "copy.txt", originalPath: "source.txt", index: FileState.Unmodified, worktree: FileState.Copied, conflict: null, submodule: null, indexCounts: null, worktreeCounts: null },
        { path: "both.txt", originalPath: null, index: FileState.Unmodified, worktree: FileState.Unmodified, conflict: ConflictKind.BothModified, submodule: null, indexCounts: null, worktreeCounts: null },
        { path: "module", originalPath: null, index: FileState.Unmodified, worktree: FileState.Modified, conflict: null, submodule: { commitChanged: true, trackedChanges: true, untrackedChanges: true }, indexCounts: null, worktreeCounts: null },
        { path: "new dir/untracked.txt", originalPath: null, index: FileState.Untracked, worktree: FileState.Untracked, conflict: null, submodule: null, indexCounts: null, worktreeCounts: null },
        { path: "build/out.txt", originalPath: null, index: FileState.Ignored, worktree: FileState.Ignored, conflict: null, submodule: null, indexCounts: null, worktreeCounts: null }
      ],
      truncated: false,
      fingerprint: "f",
      operation: null,
      remote: null,
      uncheckedLfsFiles: 0,
      fetchedAt: null
    });
  });

  test("names every kind of conflict", () => {
    const kinds = [["DD", ConflictKind.BothDeleted], ["AU", ConflictKind.AddedByUs], ["UD", ConflictKind.DeletedByThem], ["UA", ConflictKind.AddedByThem],
      ["DU", ConflictKind.DeletedByUs], ["AA", ConflictKind.BothAdded], ["UU", ConflictKind.BothModified]] as const;

    const status = StatusParser.parse(output(...kinds.map(([states]) => `u ${states} N... 100644 100644 100644 100644 ${ID} ${ID} ${ID} ${states}.txt`)), false, 100);

    assert.deepEqual(status.entries.map(t => t.conflict), kinds.map(([, kind]) => kind));
  });

  test("reads a repository with no commits, a detached HEAD, and a gone upstream", () => {
    assert.deepEqual(json(StatusParser.parse(output("# branch.oid (initial)", "# branch.head main"), false, 100)),
      { branch: "main", head: null, upstream: null, entries: [], truncated: false, fingerprint: "f", operation: null, remote: null, uncheckedLfsFiles: 0, fetchedAt: null });
    assert.deepEqual(json(StatusParser.parse(output(`# branch.oid ${HEAD}`, "# branch.head (detached)", "# branch.upstream origin/old"), false, 100)),
      { branch: null, head: HEAD, upstream: { name: "origin/old", ahead: 0, behind: 0, gone: true, id: null }, entries: [], truncated: false, fingerprint: "f", operation: null,
        remote: null, uncheckedLfsFiles: 0, fetchedAt: null });
  });

  test("keeps a path that isn't UTF-8 as its bytes beside a readable text, and reads output with no final separator", () => {
    const status = StatusParser.parse(Buffer.concat([Buffer.from("? caf"), Buffer.from([0xe9]), Buffer.from(".txt\0? last.txt")]), false, 100);

    assert.deepEqual(status.entries.map(t => [t.path, t.pathBytes]), [["caf�.txt", Buffer.from([0x63, 0x61, 0x66, 0xe9, 0x2e, 0x74, 0x78, 0x74]).toString("base64")], ["last.txt", undefined]]);
  });

  test("stops at the entries limit and says the status was cut", () => {
    const status = StatusParser.parse(output("? a.txt", "? b.txt", "? c.txt"), false, 2);

    assert.deepEqual(status.entries.map(t => t.path), ["a.txt", "b.txt"]);
    assert.equal(status.truncated, true);
  });

  test("leaves out the entry that a cut output ends in, also a rename whose original path was cut", () => {
    assert.deepEqual(json(StatusParser.parse(Buffer.from("? a.txt\0? b.t"), true, 100))["entries"], [
      { path: "a.txt", originalPath: null, index: FileState.Untracked, worktree: FileState.Untracked, conflict: null, submodule: null, indexCounts: null, worktreeCounts: null }
    ]);
    const renamed = StatusParser.parse(Buffer.from(`2 R. N... 100644 100644 100644 ${ID} ${ID} R100 new.txt\0old`), true, 100);
    assert.deepEqual(renamed.entries, []);
    assert.equal(renamed.truncated, true);
  });

  for (const [label, records, part] of [
    ["an entry of an unknown kind", ["x a.txt"], "an entry of an unknown kind"],
    ["an entry with too few fields", ["1 .M N... 100644"], "an incomplete entry"],
    ["an unknown file state", [`1 .X N... 100644 100644 100644 ${ID} ${ID} a.txt`], "an unknown file state"],
    ["an unknown conflict", [`u XY N... 100644 100644 100644 100644 ${ID} ${ID} ${ID} a.txt`], "an unknown conflict"],
    ["an unknown submodule state", [`1 .M SXYZ 160000 160000 160000 ${ID} ${ID} module`], "an unknown submodule state"],
    ["a rename whose original path is missing", [`2 R. N... 100644 100644 100644 ${ID} ${ID} R100 new.txt`], "a rename without its original path"],
    ["ahead and behind counts it can't read", ["# branch.upstream origin/main", "# branch.ab ahead"], "ahead and behind counts"],
    ["a rename with no renamed state", [`2 .M N... 100644 100644 100644 ${ID} ${ID} R100 new.txt`, "old.txt"], "values the status model refuses"],
    ["a HEAD that isn't an object id", ["# branch.oid HEAD"], "values the status model refuses"],
    ["a branch without a name", ["# branch.head "], "values the status model refuses"]
  ] as const)
    test(`fails on ${label}, naming it without git's bytes`, () => {
      assert.throws(() => StatusParser.parse(output(...records), false, 100), unreadable(part));
    });
});
