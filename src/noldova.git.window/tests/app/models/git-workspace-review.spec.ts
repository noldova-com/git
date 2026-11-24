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

describe("GitWorkspaceReview", () => {
  it("keeps a review request with the repository it's in and the host that lists it", () => {
    const row: GitPullRequestRow = rowOf(212);
    const review: GitWorkspaceReview = new GitWorkspaceReview(row, "/work/site", "site", host);

    expect([review.row, review.folder, review.repository, review.host.hostName, review.host.claims(remote)]).toEqual([row, "/work/site", "site", "GitHub", true]);
  });
});
