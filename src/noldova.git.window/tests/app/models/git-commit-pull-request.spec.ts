/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { signal } from "@angular/core";
import { describe, expect, it } from "vitest";

import { GitPullRequestState } from "../../../src/app/enums/git-pull-request-state.ts";
import type { IGitPullRequests } from "../../../src/app/interfaces/i-git-pull-requests.ts";
import { GitBranchPullRequest } from "../../../src/app/models/git-branch-pull-request.ts";
import { GitCommitPullRequest } from "../../../src/app/models/git-commit-pull-request.ts";
import { GitPullRequestRow } from "../../../src/app/models/git-pull-request-row.ts";

describe("GitCommitPullRequest", () => {
  const host: IGitPullRequests = { claims: () => true, hostName: "GitHub", signInPage: "git-github.account", listFor: () => signal(null), refresh: () => undefined };
  const row: GitPullRequestRow = new GitPullRequestRow("pull-212", "#212", "Follow renames", "https://example.invalid/pull/212", false, 2, 5, 0, 1, "fix/renames");

  it("words a host's answer as the commit's card, keeping the last pull request while the host reads again, and has none without a pull request", () => {
    const merged: GitBranchPullRequest = GitBranchPullRequest.of(row, GitPullRequestState.Merged, false);
    const card = (answer: GitBranchPullRequest | null): readonly unknown[] | null => {
      const shown: GitCommitPullRequest | null = GitCommitPullRequest.of(host, answer);
      return shown === null ? null : [shown.host === host, shown.row.key, shown.state, shown.stateLabel, shown.note];
    };

    expect([card(merged), card(GitBranchPullRequest.reading(merged))]).toEqual([
      [true, "pull-212", "Merged", "Merged", "2 approvals · 1 of 6 checks running"],
      [true, "pull-212", "Merged", "Merged", "2 approvals · 1 of 6 checks running"]
    ]);
    expect([null, GitBranchPullRequest.reading(), GitBranchPullRequest.none(1, 0, 0), GitBranchPullRequest.signedOut(), GitBranchPullRequest.failed(null)].map(t => card(t)))
      .toEqual([null, null, null, null, null]);
  });
});
