/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { signal, type Signal } from "@angular/core";
import { describe, expect, it } from "vitest";

import type { IGitPullRequests } from "../../../src/app/interfaces/i-git-pull-requests.ts";
import type { GitPullRequestList } from "../../../src/app/models/git-pull-request-list.ts";
import { GitReviewsRead } from "../../../src/app/models/git-reviews-read.ts";
import { GitWorkspaceRow } from "../../../src/app/models/git-workspace-row.ts";

describe("GitReviewsRead", () => {
  it("holds a repository, the host that reads its review requests, and the host's answer", () => {
    const row: GitWorkspaceRow = new GitWorkspaceRow("/work/a", signal(null), signal(undefined), signal(false));
    const host: IGitPullRequests = { hostName: "GitHub", signInPage: "https://github.com/login", claims: () => true, listFor: () => signal(null), refresh: () => undefined };
    const list: Signal<GitPullRequestList | null> = signal(null);
    const value: GitReviewsRead = new GitReviewsRead(row, host, list);

    expect([value.row, value.host, value.list]).toEqual([row, host, list]);
  });
});
