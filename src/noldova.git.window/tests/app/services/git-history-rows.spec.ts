/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { GitCommit, GitGraphCommit, GitRef, RefKind } from "@noldova/git.protocol";
import { describe, expect, it } from "vitest";

import { GitHistoryRows } from "../../../src/app/services/git-history-rows.ts";

describe("GitHistoryRows", () => {
  const commitOf = (id: string, refs: readonly GitRef[]): GitGraphCommit =>
    new GitGraphCommit(new GitCommit(id.repeat(40), [], "Sample Author", "2026-11-05T17:30:00Z", id), "author@example.com", refs);
  const commits: readonly GitGraphCommit[] = [
    commitOf("a", [new GitRef(RefKind.Head, "main"), new GitRef(RefKind.Branch, "main")]),
    commitOf("b", [new GitRef(RefKind.Branch, "feature"), new GitRef(RefKind.Tag, "v1")]),
    commitOf("c", [new GitRef(RefKind.RemoteBranch, "origin/other")])
  ];
  const refsOf = (shown: readonly GitGraphCommit[]): readonly string[][] => shown.map(t => t.refs.map(r => `${r.kind}:${r.name}`));

  it("moves HEAD to the commit of the branch being switched to, keeping every other label", () => {
    expect(refsOf(GitHistoryRows.switchedTo(commits, "feature")))
      .toEqual([["Branch:main"], ["Head:feature", "Branch:feature", "Tag:v1"], ["RemoteBranch:origin/other"]]);
  });

  it("leaves the commits as they are with no switch, or when the branch isn't a loaded local branch", () => {
    expect([null, "other", "origin/other"].map(t => GitHistoryRows.switchedTo(commits, t) === commits)).toEqual([true, true, true]);
  });
});
