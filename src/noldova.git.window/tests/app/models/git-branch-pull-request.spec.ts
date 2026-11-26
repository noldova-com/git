/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { describe, expect, it } from "vitest";

import { GitPullRequestState } from "../../../src/app/enums/git-pull-request-state.ts";
import { GitPullRequestsState } from "../../../src/app/enums/git-pull-requests-state.ts";
import { GitBranchPullRequest } from "../../../src/app/models/git-branch-pull-request.ts";
import { GitPullRequestRow } from "../../../src/app/models/git-pull-request-row.ts";

describe("GitBranchPullRequest", () => {
  const row: GitPullRequestRow = new GitPullRequestRow("pull-212", "#212", "Follow renames", "https://example.invalid/pull/212", false, 2, 6, 1, 3, "fix/renames");
  const partsOf = (read: GitBranchPullRequest): readonly unknown[] =>
    [read.state, read.pullRequest, read.pullRequestState, read.isWaitingForReview, read.passed, read.failing, read.pending, read.failure];

  it("holds the branch's pull request with the checks counted on its row", () => {
    expect(partsOf(GitBranchPullRequest.of(row, GitPullRequestState.Open, true))).toEqual([GitPullRequestsState.Ready, row, GitPullRequestState.Open, true, 6, 1, 3, null]);
  });

  it("holds no pull request with the head commit's checks", () => {
    expect(partsOf(GitBranchPullRequest.none(4, 0, 2))).toEqual([GitPullRequestsState.Ready, null, null, false, 4, 0, 2, null]);
  });

  it("starts a first read with nothing, and a later read with all the last one gave but its failure", () => {
    const last: GitBranchPullRequest = GitBranchPullRequest.of(row, GitPullRequestState.Merged, false);

    expect([partsOf(GitBranchPullRequest.reading()), partsOf(GitBranchPullRequest.reading(last)), partsOf(GitBranchPullRequest.reading(GitBranchPullRequest.failed("Gone.")))])
      .toEqual([
        [GitPullRequestsState.Reading, null, null, false, 0, 0, 0, null],
        [GitPullRequestsState.Reading, row, GitPullRequestState.Merged, false, 6, 1, 3, null],
        [GitPullRequestsState.Reading, null, null, false, 0, 0, 0, null]
      ]);
  });

  it("holds the host's own word for the pull request's state, keeps it while the host reads again, and has none when the host gives none", () => {
    const completed: GitBranchPullRequest = GitBranchPullRequest.of(row, GitPullRequestState.Merged, false, "Completed");

    expect([completed.stateLabel, GitBranchPullRequest.reading(completed).stateLabel, GitBranchPullRequest.of(row, GitPullRequestState.Merged, false).stateLabel,
      GitBranchPullRequest.reading().stateLabel]).toEqual(["Completed", "Completed", null, null]);
  });

  it("says the person is signed out, with nothing counted", () => {
    expect(partsOf(GitBranchPullRequest.signedOut())).toEqual([GitPullRequestsState.SignedOut, null, null, false, 0, 0, 0, null]);
  });

  it("keeps why a read failed in the host's words, or no reason when it gave none", () => {
    expect([partsOf(GitBranchPullRequest.failed("The host is down.")), partsOf(GitBranchPullRequest.failed(null))]).toEqual([
      [GitPullRequestsState.Failed, null, null, false, 0, 0, 0, "The host is down."],
      [GitPullRequestsState.Failed, null, null, false, 0, 0, 0, null]
    ]);
  });
});
