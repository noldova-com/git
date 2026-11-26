/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";

import { describe, it } from "vitest";

import * as api from "../../src/api/index.ts";

describe("The hosting protocol package's API", () => {
  it("exports its values, and each enum valued by its names", () => {
    assert.deepEqual(Object.keys(api).toSorted(), [
      "AuthorQuery",
      "BranchPullRequest",
      "BranchQuery",
      "CheckState",
      "CommitQuery",
      "DeviceCode",
      "FileChangeKind",
      "HostAccount",
      "HostAvatar",
      "HostBuild",
      "HostCapabilities",
      "HostCapability",
      "HostChanges",
      "HostCheck",
      "HostComment",
      "HostCommitComments",
      "HostItem",
      "HostPerson",
      "HostPolicy",
      "HostPullRequest",
      "HostPullRequestCommit",
      "HostPullRequestCommits",
      "HostPullRequestConflicts",
      "HostPullRequestFile",
      "HostPullRequestFiles",
      "HostPullRequestHead",
      "HostPullRequestHeads",
      "HostPullRequestList",
      "HostPullRequestRow",
      "HostPullRequestThreads",
      "HostPullRequestUpdate",
      "HostPullRequestUpdates",
      "HostReference",
      "HostReviewRequest",
      "HostReviewRequestList",
      "HostReviewer",
      "HostSignIn",
      "HostThread",
      "HostWorkItem",
      "HostWorkItemDetail",
      "HostWorkItemLink",
      "HostWorkItemList",
      "HostWorkItemType",
      "HostingArgumentException",
      "HostingFieldException",
      "HostingNames",
      "HostingProtocolException",
      "PersonQuery",
      "PolicyState",
      "PullRequestDraft",
      "PullRequestStatus",
      "ReferenceKind",
      "ReferenceState",
      "RepositoryQuery",
      "ReviewDecision",
      "SignInFailure",
      "SignInState",
      "ThreadStatus",
      "WorkItemCategory",
      "WorkItemQuery",
      "WorkItemScope",
      "WorkItemUpdate",
      "WorkItemsQuery"
    ]);
    assert.equal("ArgumentException" in api, false);
    assert.deepEqual(api.SignInState, { SignedOut: "SignedOut", Waiting: "Waiting", SignedIn: "SignedIn" });
    assert.deepEqual(api.SignInFailure, { Expired: "Expired", Denied: "Denied", Revoked: "Revoked", Unreachable: "Unreachable", Refused: "Refused", Unkept: "Unkept", Unforgotten: "Unforgotten" });
    assert.deepEqual(api.ReferenceKind, { PullRequest: "PullRequest", Issue: "Issue" });
    assert.deepEqual(api.ReferenceState, { Open: "Open", Draft: "Draft", Merged: "Merged", Closed: "Closed", ClosedDone: "ClosedDone", ClosedNotPlanned: "ClosedNotPlanned" });
    assert.deepEqual(api.CheckState, { Queued: "Queued", Running: "Running", Succeeded: "Succeeded", Failed: "Failed", Neutral: "Neutral" });
    assert.deepEqual(api.FileChangeKind, { Added: "Added", Modified: "Modified", Deleted: "Deleted", Renamed: "Renamed" });
    assert.deepEqual(api.ReviewDecision, { Waiting: "Waiting", ChangesRequested: "ChangesRequested", Approved: "Approved" });
    assert.deepEqual(api.HostCapability, { SignIn: "SignIn", ReadItem: "ReadItem", BranchPullRequest: "BranchPullRequest", CreatePullRequest: "CreatePullRequest",
      Checks: "Checks", Votes: "Votes", Policies: "Policies", Builds: "Builds", AutoComplete: "AutoComplete", WorkItems: "WorkItems",
      BranchFromItem: "BranchFromItem", Pipelines: "Pipelines", AuthorAvatars: "AuthorAvatars",
      PullRequests: "PullRequests" });
    assert.deepEqual(api.PullRequestStatus, { Failed: "Failed", Pending: "Pending", Succeeded: "Succeeded", None: "None" });
    assert.deepEqual(api.PolicyState, { Queued: "Queued", Running: "Running", Approved: "Approved", Rejected: "Rejected", NotApplicable: "NotApplicable" });
    assert.deepEqual(api.WorkItemCategory, { Proposed: "Proposed", InProgress: "InProgress", Resolved: "Resolved", Completed: "Completed", Removed: "Removed" });
    assert.deepEqual(api.ThreadStatus, { Active: "Active", Pending: "Pending", Resolved: "Resolved", WontFix: "WontFix", ByDesign: "ByDesign", Closed: "Closed",
      None: "None" });
    assert.deepEqual(api.WorkItemScope, { Mine: "Mine", Ids: "Ids" });
  });
});
