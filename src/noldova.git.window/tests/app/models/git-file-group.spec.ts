/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ConflictKind, DiffScopeKind, FileState, LineCounts } from "@noldova/git.protocol";
import { describe, expect, it } from "vitest";

import { GitFileGroupKind } from "../../../src/app/enums/git-file-group-kind.ts";
import { GitFileGroup } from "../../../src/app/models/git-file-group.ts";
import { GitFixtures } from "../../fixtures/git-fixtures.fixture.ts";

describe("GitFileGroup", () => {
  it("lists conflicts first, then staged, then changed files, a file staged and changed again in both", () => {
    const groups: readonly GitFileGroup[] = GitFileGroup.groupsOf([
      GitFixtures.entry("src/both.ts", FileState.Modified, FileState.Modified),
      GitFixtures.entry("new.md", FileState.Untracked, FileState.Untracked, new LineCounts(9, 0)),
      GitFixtures.entry("docs/a.md", FileState.Unmodified, FileState.Unmodified, null, ConflictKind.BothModified),
      GitFixtures.entry("gone.ts", FileState.Deleted, FileState.Unmodified),
      GitFixtures.entry("added.ts", FileState.Added, FileState.Unmodified),
      GitFixtures.entry("ignored.log", FileState.Ignored, FileState.Ignored)
    ]);

    expect(groups.map(t => [t.kind, t.rows.map(u => `${u.letter} ${u.path} ${u.tone}`)])).toEqual([
      [GitFileGroupKind.Conflicts, ["! docs/a.md Conflict"]],
      [GitFileGroupKind.Staged, ["M src/both.ts Modified", "D gone.ts Removed", "A added.ts Added"]],
      [GitFileGroupKind.Changes, ["M src/both.ts Modified", "U new.md Untracked"]]
    ]);
  });

  it("splits each row's path into its folder and name, and keeps the scope and counts its group reads", () => {
    const [conflicts, staged, changes] = GitFileGroup.groupsOf([
      GitFixtures.entry("a/b/c.ts", FileState.Modified, FileState.Modified, new LineCounts(3, 4)),
      GitFixtures.entry("x.md", FileState.Unmodified, FileState.Unmodified, null, ConflictKind.DeletedByThem)
    ]);
    const row = staged?.rows[0];

    expect([row?.directory, row?.fileName, row?.scope, row?.counts, row?.kind, row?.key]).toEqual(["a/b/", "c.ts", DiffScopeKind.Staged, new LineCounts(3, 4), null, "Staged:a/b/c.ts"]);
    expect(changes?.rows[0]?.scope).toBe(DiffScopeKind.Worktree);
    expect([conflicts?.rows[0]?.directory, conflicts?.rows[0]?.kind, conflicts?.rows[0]?.counts]).toEqual(["", "Deleted by them", null]);
  });

  it("lists no group for a clean folder", () => {
    expect(GitFileGroup.groupsOf([])).toEqual([]);
  });
});
