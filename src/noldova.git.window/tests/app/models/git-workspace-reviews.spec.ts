/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { signal } from "@angular/core";
import { GitRemote, RemoteTransport } from "@noldova/git.protocol";
import { describe, expect, it } from "vitest";

import type { IGitPullRequests } from "../../../src/app/interfaces/i-git-pull-requests.ts";
import { GitPullRequestRow } from "../../../src/app/models/git-pull-request-row.ts";

const host: IGitPullRequests = { claims: (remote: GitRemote) => remote.host === "github.com", hostName: "GitHub", signInPage: "git-github.account",
  listFor: () => signal(null), refresh: () => undefined };
const rowOf = (number: number): GitPullRequestRow => new GitPullRequestRow(`pull-${number}`, `#${number}`, "Follow renames",
  `https://example.invalid/pull/${number}`, false, 0, 0, 0, 0, "fix/renames");
const remote: GitRemote = new GitRemote("origin", "github.com", "octocat/site", RemoteTransport.Https);
import { GitWorkspaceReview } from "../../../src/app/models/git-workspace-review.ts";
import { GitWorkspaceReviews } from "../../../src/app/models/git-workspace-reviews.ts";

describe("GitWorkspaceReviews", () => {
  it("keeps the review requests in their order and whether the hosts have more than they listed", () => {
    const rows: readonly GitWorkspaceReview[] = [new GitWorkspaceReview(rowOf(212), "/work/site", "site", host),
      new GitWorkspaceReview(rowOf(7), "/work/docs", "docs", host)];
    const reviews: GitWorkspaceReviews = new GitWorkspaceReviews(rows, true);

    expect([reviews.rows.map(t => t.row.label), reviews.hasMore, new GitWorkspaceReviews([], false).rows, remote.host]).toEqual([["#212", "#7"], true, [],
      "github.com"]);
  });
});
