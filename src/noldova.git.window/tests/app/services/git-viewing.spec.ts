/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { GitCommit, GitGraphCommit } from "@noldova/git.protocol";
import { describe, expect, it, onTestFinished } from "vitest";

import { GitBranchView } from "../../../src/app/models/git-branch-view.ts";
import { GitCommitView } from "../../../src/app/models/git-commit-view.ts";
import { GitViewing } from "../../../src/app/services/git-viewing.ts";

describe("GitViewing", () => {
  const folder: string = "/work/project";

  it("picks no branch and selects no commit at first, for any folder", () => {
    expect([GitViewing.branchOf(folder), GitViewing.branchOf(null), GitViewing.commitOf(folder), GitViewing.commitOf(null)]).toEqual([null, null, null, null]);
  });

  it("gives the picked branch only to the folder whose side panel picked it", () => {
    onTestFinished(() => GitViewing.branch.set(null));
    const view: GitBranchView = new GitBranchView(folder, "feature", false);

    GitViewing.branch.set(view);

    expect([GitViewing.branchOf(folder), GitViewing.branchOf("/work/other"), GitViewing.branchOf(null)]).toEqual([view, null, null]);
  });

  it("gives the selected commit only to the folder whose history selected it", () => {
    onTestFinished(() => GitViewing.commit.set(null));
    const view: GitCommitView = new GitCommitView(folder, new GitGraphCommit(new GitCommit("c".repeat(40), ["d".repeat(40)], "Sample Author", "2026-11-20T14:02:00Z",
      "Follow renames"), "author@example.com", []));

    GitViewing.commit.set(view);

    expect([GitViewing.commitOf(folder), GitViewing.commitOf("/work/other"), GitViewing.commitOf(null)]).toEqual([view, null, null]);
  });
});
