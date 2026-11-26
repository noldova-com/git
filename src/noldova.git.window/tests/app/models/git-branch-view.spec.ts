/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { GitCommit, GitGraphCommit, GitRef, RefKind } from "@noldova/git.protocol";
import { describe, expect, it } from "vitest";

import { GitBranchView } from "../../../src/app/models/git-branch-view.ts";

describe("GitBranchView", () => {
  const commit: GitGraphCommit = new GitGraphCommit(new GitCommit("a".repeat(40), [], "Sample Author", "2026-11-06T17:30:00Z", "Subject"), "author@example.com",
    [new GitRef(RefKind.Head, "rr/ai-ui"), new GitRef(RefKind.Branch, "rr/ai-ui"), new GitRef(RefKind.RemoteBranch, "origin/main"), new GitRef(RefKind.Tag, "main")]);

  it("finds a local branch by its branch ref and a remote one by its remote ref, never by a tag or the other kind", () => {
    expect([
      new GitBranchView("/work", "rr/ai-ui", false).isAt(commit),
      new GitBranchView("/work", "origin/main", true).isAt(commit),
      new GitBranchView("/work", "main", false).isAt(commit),
      new GitBranchView("/work", "rr/ai-ui", true).isAt(commit)
    ]).toEqual([true, true, false, false]);
  });

  it("finds a commit by its whole id alone, whatever refs it has", () => {
    expect([new GitBranchView("/work", "", false, "a".repeat(40)).isAt(commit), new GitBranchView("/work", "", false, "b".repeat(40)).isAt(commit)]).toEqual([true, false]);
  });
});
