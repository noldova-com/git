/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { signal } from "@angular/core";
import { describe, expect, it } from "vitest";

import { GitBranchPullRequest } from "../../../src/app/models/git-branch-pull-request.ts";
import { GitPullRequestRow } from "../../../src/app/models/git-pull-request-row.ts";
import { GitPullRequestStack } from "../../../src/app/models/git-pull-request-stack.ts";
import { GitWorkspaceRow } from "../../../src/app/models/git-workspace-row.ts";

const pullOf = (number: number, head: string, base: string): GitPullRequestRow =>
  new GitPullRequestRow(String(number), `#${number}`, `Change ${number}`, `https://github.com/example-owner/git/pull/${number}`, false, 0, 0, 0, 0, head, base);

describe("GitPullRequestStack", () => {
  it("holds the repository and its pull requests in the order they merge, the bottom one first", () => {
    const row = new GitWorkspaceRow("/work/git", signal(null), signal(GitBranchPullRequest.none(0, 0, 0)), signal(false));
    const bottom = pullOf(12, "feature/read", "main");
    const above = [pullOf(13, "feature/draw", "feature/read"), pullOf(14, "feature/zoom", "feature/draw")];

    const stack = new GitPullRequestStack(row, bottom, above);

    expect([stack.row, stack.bottom, stack.pullRequests.map(t => t.label)]).toEqual([row, bottom, ["#12", "#13", "#14"]]);
  });

  it("holds the bottom one alone when nothing is stacked on it", () => {
    const row = new GitWorkspaceRow("/work/git", signal(null), signal(GitBranchPullRequest.none(0, 0, 0)), signal(false));
    const bottom = pullOf(12, "feature/read", "main");

    expect(new GitPullRequestStack(row, bottom, []).pullRequests).toEqual([bottom]);
  });
});
