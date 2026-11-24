/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";

import { describe, it } from "vitest";

import { HostingNames } from "../../src/api/index.ts";

describe("HostingNames", () => {
  it("names each sign-in member after the host module's id", () => {
    const names: readonly string[] = [HostingNames.readSignInMethod, HostingNames.startSignInMethod, HostingNames.cancelSignInMethod,
      HostingNames.signInWithTokenMethod, HostingNames.signOutMethod, HostingNames.signInChangedEvent].map(t => HostingNames.nameOf("git-github", t));

    assert.deepEqual(names, ["git-github.readSignIn", "git-github.startSignIn", "git-github.cancelSignIn", "git-github.signInWithToken", "git-github.signOut",
      "git-github.signInChanged"]);
  });

  it("names each pull request member after the host module's id", () => {
    const names: readonly string[] = [HostingNames.readReferenceMethod, HostingNames.readBranchPullRequestMethod, HostingNames.readPullRequestMethod,
      HostingNames.createPullRequestMethod, HostingNames.readAuthorAvatarMethod, HostingNames.readPersonAvatarMethod,
      HostingNames.readCommitPullRequestMethod].map(t => HostingNames.nameOf("git-github", t));

    assert.deepEqual(names, ["git-github.readReference", "git-github.readBranchPullRequest", "git-github.readPullRequest", "git-github.createPullRequest",
      "git-github.readAuthorAvatar", "git-github.readPersonAvatar", "git-github.readCommitPullRequest"]);
  });

  it("names the work item read after the host module's id", () => {
    assert.equal(HostingNames.nameOf("git-azure-devops", HostingNames.readWorkItemMethod), "git-azure-devops.readWorkItem");
  });

  it("names the work item list read and the work item update after the host module's id", () => {
    const names: readonly string[] = [HostingNames.readWorkItemsMethod, HostingNames.updateWorkItemMethod].map(t => HostingNames.nameOf("git-azure-devops", t));

    assert.deepEqual(names, ["git-azure-devops.readWorkItems", "git-azure-devops.updateWorkItem"]);
  });

  it("names the pull request list read after the host module's id", () => {
    assert.deepEqual(["git-github", "git-azure-devops"].map(t => HostingNames.nameOf(t, HostingNames.readPullRequestsMethod)),
      ["git-github.readPullRequests", "git-azure-devops.readPullRequests"]);
  });

  it("names the review request read after the host module's id", () => {
    assert.deepEqual(["git-github", "git-azure-devops"].map(t => HostingNames.nameOf(t, HostingNames.readReviewRequestsMethod)),
      ["git-github.readReviewRequests", "git-azure-devops.readReviewRequests"]);
  });

  it("names the commit comment count read after the host module's id", () => {
    assert.deepEqual(["git-github", "git-azure-devops"].map(t => HostingNames.nameOf(t, HostingNames.readCommitCommentsMethod)),
      ["git-github.readCommitComments", "git-azure-devops.readCommitComments"]);
  });

  it("names the pull request threads read after the host module's id", () => {
    assert.equal(HostingNames.nameOf("git-azure-devops", HostingNames.readPullRequestThreadsMethod), "git-azure-devops.readPullRequestThreads");
  });
});
