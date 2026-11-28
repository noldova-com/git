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

import { AzureDevOpsNames } from "../../src/api/index.ts";

const declaration: JsonReader = JsonReader.parse(readFileSync(new URL("../../../noldova.git.azure-devops/module.json", import.meta.url), "utf8"));

describe("AzureDevOpsNames", () => {
  it("names the module, its methods and its event as its module.json declares them", () => {
    const contributes: JsonReader = declaration.readObject("contributes");

    assert.equal(AzureDevOpsNames.moduleId, declaration.readString("id"));
    assert.deepEqual(contributes.readStringArray("methods"),
      [AzureDevOpsNames.readSignInMethod, AzureDevOpsNames.startSignInMethod, AzureDevOpsNames.cancelSignInMethod, AzureDevOpsNames.signInWithTokenMethod,
        AzureDevOpsNames.signOutMethod, AzureDevOpsNames.readReferenceMethod, AzureDevOpsNames.readBranchPullRequestMethod, AzureDevOpsNames.readPullRequestMethod, AzureDevOpsNames.readWorkItemMethod,
        AzureDevOpsNames.readWorkItemsMethod,
        AzureDevOpsNames.updateWorkItemMethod, AzureDevOpsNames.readAuthorAvatarMethod, AzureDevOpsNames.readPersonAvatarMethod, AzureDevOpsNames.readPullRequestsMethod,
        AzureDevOpsNames.readPullRequestHeadsMethod, AzureDevOpsNames.readPullRequestThreadsMethod, AzureDevOpsNames.linkBranchMethod,
        AzureDevOpsNames.replyToThreadMethod, AzureDevOpsNames.changeThreadMethod, AzureDevOpsNames.voteMethod,
        AzureDevOpsNames.readMergeTypesMethod, AzureDevOpsNames.completePullRequestMethod, AzureDevOpsNames.setAutoCompleteMethod,
        AzureDevOpsNames.cancelAutoCompleteMethod, AzureDevOpsNames.abandonPullRequestMethod,
        AzureDevOpsNames.searchPeopleMethod, AzureDevOpsNames.readCommitPullRequestMethod,
        AzureDevOpsNames.addReviewerMethod, AzureDevOpsNames.readReviewRequestsMethod, AzureDevOpsNames.readCommitCommentsMethod,
        AzureDevOpsNames.readPullRequestCommitsMethod, AzureDevOpsNames.readPullRequestUpdatesMethod, AzureDevOpsNames.readPullRequestChangesMethod,
        AzureDevOpsNames.readPullRequestConflictsMethod, AzureDevOpsNames.readAccountsMethod, AzureDevOpsNames.addAccountMethod,
        AzureDevOpsNames.readRepositoryAccountMethod, AzureDevOpsNames.pickAccountMethod]);
    assert.deepEqual([AzureDevOpsNames.readAccountsMethod, AzureDevOpsNames.addAccountMethod, AzureDevOpsNames.readRepositoryAccountMethod,
      AzureDevOpsNames.pickAccountMethod, AzureDevOpsNames.accountsChangedEvent], ["git-azure-devops.readAccounts", "git-azure-devops.addAccount",
      "git-azure-devops.readRepositoryAccount", "git-azure-devops.pickAccount", "git-azure-devops.accountsChanged"]);
    assert.deepEqual([AzureDevOpsNames.readPullRequestsMethod, AzureDevOpsNames.readReviewRequestsMethod, AzureDevOpsNames.readCommitCommentsMethod],
      ["git-azure-devops.readPullRequests", "git-azure-devops.readReviewRequests", "git-azure-devops.readCommitComments"]);
    assert.deepEqual([AzureDevOpsNames.readPullRequestThreadsMethod, AzureDevOpsNames.readPullRequestHeadsMethod],
      ["git-azure-devops.readPullRequestThreads", "git-azure-devops.readPullRequestHeads"]);
    assert.deepEqual([AzureDevOpsNames.readPullRequestCommitsMethod, AzureDevOpsNames.readPullRequestUpdatesMethod, AzureDevOpsNames.readPullRequestChangesMethod,
      AzureDevOpsNames.readPullRequestConflictsMethod], ["git-azure-devops.readPullRequestCommits", "git-azure-devops.readPullRequestUpdates",
      "git-azure-devops.readPullRequestChanges", "git-azure-devops.readPullRequestConflicts"]);
    assert.deepEqual([AzureDevOpsNames.replyToThreadMethod, AzureDevOpsNames.changeThreadMethod], ["git-azure-devops.replyToThread", "git-azure-devops.changeThread"]);
    assert.equal(AzureDevOpsNames.voteMethod, "git-azure-devops.vote");
    assert.deepEqual([AzureDevOpsNames.readMergeTypesMethod, AzureDevOpsNames.completePullRequestMethod, AzureDevOpsNames.setAutoCompleteMethod,
      AzureDevOpsNames.cancelAutoCompleteMethod, AzureDevOpsNames.abandonPullRequestMethod], ["git-azure-devops.readMergeTypes", "git-azure-devops.completePullRequest",
      "git-azure-devops.setAutoComplete", "git-azure-devops.cancelAutoComplete", "git-azure-devops.abandonPullRequest"]);
    assert.deepEqual([AzureDevOpsNames.searchPeopleMethod, AzureDevOpsNames.addReviewerMethod], ["git-azure-devops.searchPeople", "git-azure-devops.addReviewer"]);
    assert.equal(AzureDevOpsNames.readCommitPullRequestMethod, "git-azure-devops.readCommitPullRequest");
    assert.deepEqual(contributes.readStringArray("events"), [AzureDevOpsNames.signInChangedEvent, AzureDevOpsNames.accountsChangedEvent]);
    assert.equal(AzureDevOpsNames.signInWithTokenMethod, "git-azure-devops.signInWithToken");
    assert.deepEqual([AzureDevOpsNames.startSignInMethod, AzureDevOpsNames.cancelSignInMethod], ["git-azure-devops.startSignIn", "git-azure-devops.cancelSignIn"]);
    assert.equal(AzureDevOpsNames.readWorkItemMethod, "git-azure-devops.readWorkItem");
    assert.equal(AzureDevOpsNames.readWorkItemsMethod, "git-azure-devops.readWorkItems");
    assert.equal(AzureDevOpsNames.updateWorkItemMethod, "git-azure-devops.updateWorkItem");
    assert.equal(AzureDevOpsNames.readAuthorAvatarMethod, "git-azure-devops.readAuthorAvatar");
    assert.equal(AzureDevOpsNames.readPersonAvatarMethod, "git-azure-devops.readPersonAvatar");
  });

  it("declares what the module does today: a token sign-in, reading a pull request with its votes, policies and builds, a branch's pull request, a work item, authors' pictures and open pull requests", () => {
    assert.deepEqual(AzureDevOpsNames.capabilities.capabilities, [HostCapability.SignIn, HostCapability.ReadItem, HostCapability.BranchPullRequest,
      HostCapability.Checks, HostCapability.Votes, HostCapability.Policies, HostCapability.Builds, HostCapability.AutoComplete, HostCapability.WorkItems,
      HostCapability.AuthorAvatars, HostCapability.PullRequests]);
    assert.equal(AzureDevOpsNames.capabilities.has(HostCapability.Pipelines), false);
  });
});
