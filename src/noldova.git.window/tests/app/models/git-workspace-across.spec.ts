/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { signal } from "@angular/core";
import { describe, expect, it } from "vitest";

import type { IGitWorkspaceAcrossPage } from "../../../src/app/interfaces/i-git-workspace-across-page.ts";
import { GitBranchPullRequest } from "../../../src/app/models/git-branch-pull-request.ts";
import { GitWorkspaceAcross } from "../../../src/app/models/git-workspace-across.ts";
import { GitWorkspaceReviews } from "../../../src/app/models/git-workspace-reviews.ts";
import { GitWorkspaceRow } from "../../../src/app/models/git-workspace-row.ts";

describe("GitWorkspaceAcross", () => {
  it("holds a workspace page's instance, its repositories, the agents' runs, the reviews asked and the page", () => {
    const rows = [new GitWorkspaceRow("/work/git", signal(null), signal(GitBranchPullRequest.none(0, 0, 0)), signal(false))];
    const reviews = new GitWorkspaceReviews([], false);
    const page: IGitWorkspaceAcrossPage = { open: () => undefined, openPullRequest: () => undefined, openReview: () => undefined, readWritten: () => undefined };

    const across = new GitWorkspaceAcross("workspace-1", rows, [], reviews, page);

    expect([across.instance, across.rows, across.runs, across.reviews, across.page]).toEqual(["workspace-1", rows, [], reviews, page]);
  });
});
