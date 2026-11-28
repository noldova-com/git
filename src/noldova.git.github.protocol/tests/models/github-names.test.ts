/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { JsonReader } from "@noldova/context.json";
import { HostCapability } from "@noldova/git.hosting.protocol";
import { describe, it } from "vitest";

import { GitHubNames } from "../../src/api/index.ts";

describe("GitHubNames", () => {
  it("names the module as its module.json declares it", () => {
    const declaration: JsonReader = JsonReader.parse(readFileSync(new URL("../../../noldova.git.github/module.json", import.meta.url), "utf8"));

    assert.equal(GitHubNames.moduleId, declaration.readString("id"));
  });
  it("names the sign-in's and the reads' methods, the event and the tools as its module.json contributes them", () => {
    const contributes: JsonReader = JsonReader.parse(readFileSync(new URL("../../../noldova.git.github/module.json", import.meta.url), "utf8")).readObject("contributes");

    assert.deepEqual(contributes.readStringArray("methods"),
      [GitHubNames.readSignInMethod, GitHubNames.startSignInMethod, GitHubNames.cancelSignInMethod, GitHubNames.signOutMethod,
        GitHubNames.readReferenceMethod, GitHubNames.readBranchPullRequestMethod, GitHubNames.createPullRequestMethod,
        GitHubNames.readAuthorAvatarMethod, GitHubNames.readPullRequestsMethod, GitHubNames.readReviewRequestsMethod, GitHubNames.readCommitCommentsMethod,
        GitHubNames.readPullRequestMethod, GitHubNames.readPullRequestThreadsMethod, GitHubNames.readCommitPullRequestMethod, GitHubNames.readAccountsMethod,
        GitHubNames.addAccountMethod, GitHubNames.readRepositoryAccountMethod, GitHubNames.pickAccountMethod, GitHubNames.useFolderMethod,
        GitHubNames.signInWithTokenMethod]);
    assert.deepEqual([GitHubNames.readAccountsMethod, GitHubNames.addAccountMethod, GitHubNames.readRepositoryAccountMethod, GitHubNames.pickAccountMethod,
      GitHubNames.useFolderMethod, GitHubNames.signInWithTokenMethod], ["git-github.readAccounts", "git-github.addAccount", "git-github.readRepositoryAccount",
      "git-github.pickAccount", "git-github.useFolder", "git-github.signInWithToken"]);
    assert.deepEqual([GitHubNames.readPullRequestsMethod, GitHubNames.readReviewRequestsMethod, GitHubNames.readCommitCommentsMethod],
      ["git-github.readPullRequests", "git-github.readReviewRequests", "git-github.readCommitComments"]);
    assert.deepEqual([GitHubNames.readPullRequestMethod, GitHubNames.readPullRequestThreadsMethod, GitHubNames.readCommitPullRequestMethod],
      ["git-github.readPullRequest", "git-github.readPullRequestThreads", "git-github.readCommitPullRequest"]);
    assert.deepEqual(contributes.readStringArray("events"), [GitHubNames.signInChangedEvent, GitHubNames.accountsChangedEvent]);
    assert.equal(GitHubNames.accountsChangedEvent, "git-github.accountsChanged");
    assert.deepEqual(contributes.readStringArray("tools"), [GitHubNames.readTool, GitHubNames.prChecksTool, GitHubNames.prCreateTool]);
    assert.equal(GitHubNames.accessService, "git-github.access");
    assert.equal(GitHubNames.manageAccessUrl, `https://github.com/settings/connections/applications/${GitHubNames.clientId}`);
  });
  it("declares what the module does today: sign-in, reading an item and a branch's pull request with its checks, opening a pull request, showing authors' pictures and listing pull requests", () => {
    assert.deepEqual(GitHubNames.capabilities.capabilities, [HostCapability.SignIn, HostCapability.ReadItem, HostCapability.BranchPullRequest,
      HostCapability.CreatePullRequest, HostCapability.Checks, HostCapability.AuthorAvatars, HostCapability.PullRequests]);
    assert.equal(GitHubNames.capabilities.has(HostCapability.Votes), false);
  });
});
