/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { GitCommit, GitGraphCommit } from "@noldova/git.protocol";
import { describe, expect, it } from "vitest";

import { GitGraphRow } from "../../../src/app/models/git-graph-row.ts";
import { GitHistoryRow } from "../../../src/app/models/git-history-row.ts";
import { GitRefChip } from "../../../src/app/models/git-ref-chip.ts";
import type { GitChipSplit } from "../../../src/app/models/git-chip-split.ts";

describe("GitHistoryRow", () => {
  const graph: GitGraphRow = new GitGraphRow(new GitGraphCommit(new GitCommit("c".repeat(40), ["d".repeat(40)], "Sample Author", "2026-11-20T14:02:00Z",
    "Follow renames"), "author@example.com", []), 0, 0, [], 1);
  const chips: readonly GitRefChip[] = [
    new GitRefChip("main", "commit", false, true, "main"), new GitRefChip("origin/topic", "cloud", false, false, "origin/topic"), new GitRefChip("v1", "sell", true, false)
  ];
  const row: GitHistoryRow = new GitHistoryRow(graph, chips, false, true, "Follow renames", "Sample Author", "SA", "https://example.com/avatar.png", "5 min ago", true);
  const namesOf = ({ shown, hidden }: GitChipSplit): readonly (readonly string[])[] => [shown.map(t => t.name), hidden.map(t => t.name)];

  it("holds the graph row, the labels, the columns' texts and whether it matches, and takes its id from the commit", () => {
    expect([row.graph, row.chips, row.isChanges, row.isHead, row.message, row.author, row.initials, row.avatar, row.age, row.matches, row.id]).toEqual([
      graph, chips, false, true, "Follow renames", "Sample Author", "SA", "https://example.com/avatar.png", "5 min ago", true, "c".repeat(40)
    ]);
  });

  it("shows the labels up to the limit and lists those past it apart", () => {
    expect([namesOf(row.chipsWithin(1)), namesOf(row.chipsWithin(2))]).toEqual([[["main"], ["origin/topic", "v1"]], [["main", "origin/topic"], ["v1"]]]);
  });

  it("shows every label when they fit within the limit", () => {
    expect([namesOf(row.chipsWithin(3)), namesOf(row.chipsWithin(5))]).toEqual([[["main", "origin/topic", "v1"], []], [["main", "origin/topic", "v1"], []]]);
  });
});
