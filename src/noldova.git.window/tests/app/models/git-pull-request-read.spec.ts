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
import { GitBranchPullRequest } from "../../../src/app/models/git-branch-pull-request.ts";
import { GitPullRequestRead } from "../../../src/app/models/git-pull-request-read.ts";

describe("GitPullRequestRead", () => {
  it("holds the host that claims a remote and its answer for a commit", () => {
    const host: IGitPullRequests = { hostName: "GitHub", signInPage: "https://github.com/login", claims: () => true, listFor: () => signal(null), refresh: () => undefined };
    const answer: Signal<GitBranchPullRequest | null> = signal(GitBranchPullRequest.none(1, 0, 0));
    const value: GitPullRequestRead = new GitPullRequestRead(host, answer);

    expect([value.host, value.answer]).toEqual([host, answer]);
  });
});
