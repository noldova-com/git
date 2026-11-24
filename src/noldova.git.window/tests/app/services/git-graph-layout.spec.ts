/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { GitCommit, GitGraphCommit } from "@noldova/git.protocol";
import { describe, expect, it } from "vitest";

import type { GitGraphRow } from "../../../src/app/models/git-graph-row.ts";
import { GitGraphLayout } from "../../../src/app/services/git-graph-layout.ts";

describe("GitGraphLayout", () => {
  const id = (name: string): string => name.charCodeAt(0).toString(16).padStart(40, "0");
  const commit = (name: string, ...parents: string[]): GitGraphCommit =>
    new GitGraphCommit(new GitCommit(id(name), parents.map(id), "Kim", "2026-11-21T10:00:00Z", `Commit ${name}`), "kim@example.com", []);
  const shapeOf = (rows: readonly GitGraphRow[]): readonly string[] =>
    rows.map(row => `${row.lane}/${row.width}: ${row.lines.map(t => `${t.fromLane}${t.fromMiddle ? "m" : "t"}-${t.toLane}${t.toMiddle ? "m" : "b"}`).join(" ")}`);

  it("lays nothing out for no commits", () => {
    expect(GitGraphLayout.layout([])).toEqual([]);
  });

  it("keeps a straight history in one lane, joined row to row, with the root ending its lane", () => {
    expect(shapeOf(GitGraphLayout.layout([commit("c", "b"), commit("b", "a"), commit("a")]))).toEqual([
      "0/1: 0m-0b",
      "0/1: 0t-0m 0m-0b",
      "0/1: 0t-0m"
    ]);
  });

  it("opens a lane for a merge's second parent and pulls it back into the first lane where that branch forks off", () => {
    const rows = GitGraphLayout.layout([commit("m", "b", "f"), commit("f", "a"), commit("b", "a"), commit("a")]);
    expect(shapeOf(rows)).toEqual([
      "0/2: 0m-0b 0m-1b",
      "1/2: 0t-0b 1t-1m 1m-1b",
      "0/2: 0t-0m 1t-0b 0m-0b",
      "0/1: 0t-0m"
    ]);
    expect(rows[0]?.isMerge).toBe(true);
    expect(rows[1]?.isMerge).toBe(false);
  });

  it("starts a new lane for a branch tip no row waits for, beside the lanes already waiting", () => {
    expect(shapeOf(GitGraphLayout.layout([commit("x", "a"), commit("y", "a"), commit("a")]))).toEqual([
      "0/1: 0m-0b",
      "1/2: 0t-0b 1m-0b",
      "0/1: 0t-0m"
    ]);
  });

  it("reuses a freed lane before widening the graph", () => {
    const rows = GitGraphLayout.layout([commit("m", "b", "f"), commit("f", "a"), commit("b", "a"), commit("a"), commit("z")]);
    expect(rows[4]?.lane).toBe(0);
    expect(rows[4]?.width).toBe(1);
  });

  it("keeps a lane's color from the row that opens it to the row that closes it, and gives a new lane the next color", () => {
    const rows = GitGraphLayout.layout([commit("m", "b", "f"), commit("f", "a"), commit("b", "a"), commit("a")]);
    expect(rows.map(t => t.color)).toEqual([0, 1, 0, 0]);
    expect(rows[1]?.lines.find(t => t.fromLane === 1 && !t.fromMiddle)?.color).toBe(1);
    expect(rows[2]?.lines.find(t => t.fromLane === 1)?.color).toBe(1);
  });

  it("keeps another branch in its own lane and color where a branch forks off it, the branch curving into it in its own color", () => {
    const rows = GitGraphLayout.layout([commit("f", "e"), commit("m", "p"), commit("e", "p"), commit("p")]);
    expect(shapeOf(rows)).toEqual([
      "0/1: 0m-0b",
      "1/2: 0t-0b 1m-1b",
      "0/2: 0t-0m 1t-1b 0m-1b",
      "1/2: 1t-1m"
    ]);
    expect([rows.map(t => t.color), rows[2]?.lines.map(t => t.color)]).toEqual([[0, 1, 0, 1], [0, 1, 0]]);
  });

  it("draws a merge's edge to a second parent another lane already waits for in that lane's color", () => {
    const rows = GitGraphLayout.layout([commit("x", "b"), commit("m", "a", "b"), commit("b"), commit("a")]);
    expect(rows[1]?.lines.filter(t => t.fromMiddle).map(t => `${t.toLane}:${t.color}`)).toEqual(["1:1", "0:0"]);
  });

  it("gives a new tip a free lane between taken ones, in a new color", () => {
    const rows = GitGraphLayout.layout([commit("t", "p"), commit("u", "q"), commit("v", "r"), commit("q"), commit("w", "s")]);
    expect([rows[4]?.lane, rows[4]?.color, rows[4]?.width]).toEqual([1, 3, 3]);
  });

  it("joins a merge's first parent to the lane on its left that waits for it, and opens its second parent past its own freed lane", () => {
    expect(shapeOf(GitGraphLayout.layout([commit("x", "a"), commit("m", "a", "z"), commit("z"), commit("a")]))).toEqual([
      "0/1: 0m-0b",
      "1/3: 0t-0b 1m-0b 1m-2b",
      "2/3: 0t-0b 2t-2m",
      "0/1: 0t-0m"
    ]);
  });

  it("wraps colors after eight lanes", () => {
    const tips = Array.from({ length: 9 }, (_, index) => commit(String.fromCharCode(98 + index), "a"));
    expect(GitGraphLayout.layout([...tips, commit("a")]).map(t => t.color).slice(0, 9)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 0]);
  });
});
