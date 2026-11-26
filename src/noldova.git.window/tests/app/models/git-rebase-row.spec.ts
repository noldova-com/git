/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { GitRebaseCommit, RebaseAction } from "@noldova/git.protocol";
import { describe, expect, it } from "vitest";

import { GitRebaseRow } from "../../../src/app/models/git-rebase-row.ts";

describe("GitRebaseRow", () => {
  const a: GitRebaseCommit = new GitRebaseCommit("a".repeat(40), "Add a", null);
  const b: GitRebaseCommit = new GitRebaseCommit("b".repeat(40), "Add b", null);
  const fixA: GitRebaseCommit = new GitRebaseCommit("c".repeat(40), "fixup! Add a", a.id);
  const squashA: GitRebaseCommit = new GitRebaseCommit("d".repeat(40), "squash! Add a\n\nMore about a.", a.id);
  const lost: GitRebaseCommit = new GitRebaseCommit("e".repeat(40), "fixup! Gone", "f".repeat(40));

  it("folds each fixup! and squash! commit after its target and the folds already there, in their order, and keeps a fold whose target isn't listed", () => {
    const rows: GitRebaseRow[] = GitRebaseRow.arrange([a, b, fixA, squashA, lost], true);

    expect(rows.map(t => [t.commit.id[0], t.action])).toEqual([
      ["a", RebaseAction.Pick], ["c", RebaseAction.Fixup], ["d", RebaseAction.Squash], ["b", RebaseAction.Pick], ["e", RebaseAction.Pick]
    ]);
    expect(GitRebaseRow.arrange([a, b, fixA], false).map(t => t.action)).toEqual([RebaseAction.Pick, RebaseAction.Pick, RebaseAction.Pick]);
  });

  it("joins a squash group's messages by default and takes a written one, keeps a fixup's group message, and leaves dropped rows out", () => {
    const rows: GitRebaseRow[] = GitRebaseRow.arrange([a, b, fixA, squashA], true);
    const planned = GitRebaseRow.planOf(rows);

    expect(planned.results).toEqual(["Add a\n\nsquash! Add a\n\nMore about a.", "Add b"]);
    expect(planned.steps.map(t => t.message)).toEqual([null, null, "Add a\n\nsquash! Add a\n\nMore about a.", null]);
    const written = GitRebaseRow.planOf([new GitRebaseRow(a, RebaseAction.Pick).withAction(RebaseAction.Reword).withMessage("A, reworded"),
      new GitRebaseRow(squashA, RebaseAction.Squash, "All of a"), new GitRebaseRow(b, RebaseAction.Drop), new GitRebaseRow(fixA, RebaseAction.Edit)]);
    expect([written.results, written.steps.map(t => t.message)]).toEqual([["All of a", "fixup! Add a"], ["A, reworded", "All of a", null, null]]);
  });

  it("refuses rows whose first kept row folds, and takes rows with nothing kept", () => {
    expect(GitRebaseRow.isValid([new GitRebaseRow(a, RebaseAction.Drop), new GitRebaseRow(b, RebaseAction.Fixup)])).toBe(false);
    expect(GitRebaseRow.isValid([new GitRebaseRow(a, RebaseAction.Drop)])).toBe(true);
    expect(GitRebaseRow.isValid([])).toBe(true);
    expect(GitRebaseRow.move([new GitRebaseRow(a, RebaseAction.Pick), new GitRebaseRow(b, RebaseAction.Pick)], 1, 0).map(t => t.commit.id[0])).toEqual(["b", "a"]);
  });
});
