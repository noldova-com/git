/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { signal } from "@angular/core";
import { describe, expect, it } from "vitest";

import { GitPullRequestRow } from "../../../src/app/models/git-pull-request-row.ts";
import { GitRowPullRequest } from "../../../src/app/models/git-row-pull-request.ts";
import { GitWorkspaceRow } from "../../../src/app/models/git-workspace-row.ts";

describe("GitRowPullRequest", () => {
  it("keeps a workspace row with the pull request found for it", () => {
    const row: GitWorkspaceRow = new GitWorkspaceRow("/work/site", signal(null), signal(undefined), signal(false));
    const pullRequest: GitPullRequestRow = new GitPullRequestRow("pull-212", "#212", "Follow renames", "https://example.invalid/pull/212", false, 2, 6, 0, 0,
      "fix/renames");
    const found: GitRowPullRequest = new GitRowPullRequest(row, pullRequest);

    expect([found.row, found.pullRequest, found.row.folder, found.pullRequest.label]).toEqual([row, pullRequest, "/work/site", "#212"]);
  });
});
