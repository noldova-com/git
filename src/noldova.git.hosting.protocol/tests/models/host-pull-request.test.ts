/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";

import { describe, it } from "vitest";

import { CheckState, HostBuild, HostChanges, HostItem, HostPerson, HostPolicy, HostPullRequest, HostReference, HostReviewer, HostWorkItemLink, HostWorkItemType,
  PolicyState, ReferenceKind, ReferenceState, WorkItemCategory } from "../../src/api/index.ts";

const commit: string = "6dcb09b5b57875f334f61aebed695e2e4193db5e";
const item: HostItem = new HostItem(new HostReference("git-azure-devops", "fabrikam", "3411ebc1-d5aa-464f-9615-0b527bc66719", 12), ReferenceKind.PullRequest,
  ReferenceState.Open, "Add the sign-in page", "https://dev.azure.com/fabrikam/web/_git/web/pullrequest/12", new HostPerson("monalisa", null, null),
  1_800_000_000_000, null, 2, new HostChanges(10, 2, 3, "feature/sign-in", "main", commit));
const issue: HostItem = new HostItem(new HostReference("git-github", "octocat", "hello-world", 2), ReferenceKind.Issue, ReferenceState.Open,
  "Found a bug", "https://github.com/octocat/hello-world/issues/2", null, 1_800_000_000_000, null, 0, null);
const reviewer: HostReviewer = new HostReviewer(new HostPerson("octocat", null, null), 0.5, "Approved with suggestions", true);
const policy: HostPolicy = new HostPolicy("Build", PolicyState.Running, true, null);
const build: HostBuild = new HostBuild("web-ci", CheckState.Running, null, 1_800_000_000_000, null);
const workItem: HostWorkItemLink = new HostWorkItemLink(7521, "Export notes as Markdown files", new HostWorkItemType("User Story", "009CCC", "icon_book"), "Active",
  WorkItemCategory.InProgress, "https://dev.azure.com/fabrikam/_workitems/edit/7521");
const pullRequest: HostPullRequest = new HostPullRequest(item, [reviewer], [policy], [build], true, "Readers see **due dates**.", 5, [workItem], "squash", true);

describe("HostPullRequest", () => {
  it("holds a pull request with its reviewers, policies and builds, and returns itself as JSON that reads back the same", () => {
    assert.deepEqual(pullRequest.toJson(), {
      item: item.toJson(),
      reviewers: [reviewer.toJson()],
      policies: [policy.toJson()],
      builds: [build.toJson()],
      isAutoComplete: true,
      description: "Readers see **due dates**.",
      commitCount: 5,
      workItems: [workItem.toJson()],
      autoCompleteMergeType: "squash",
      hasConflicts: true
    });
    assert.deepEqual(HostPullRequest.fromJson(pullRequest.toJson()), pullRequest);
    const bare: HostPullRequest = new HostPullRequest(item, [], [], [], false, "", null, []);
    assert.deepEqual([HostPullRequest.fromJson(bare.toJson()).reviewers, bare.autoCompleteMergeType, bare.toJson()["autoCompleteMergeType"], bare.hasConflicts,
      HostPullRequest.fromJson(bare.toJson()).hasConflicts, HostPullRequest.fromJson({ ...bare.toJson(), hasConflicts: false }).hasConflicts],
    [[], null, null, null, null, false]);
  });

  it("keeps its own copies of the lists it was given", () => {
    const reviewers: HostReviewer[] = [reviewer];
    const kept: HostPullRequest = new HostPullRequest(item, reviewers, [], [], false, "", null, []);

    reviewers.pop();

    assert.equal(kept.reviewers.length, 1);
  });

  it("refuses an item that isn't a pull request, a commit count below zero or not whole and a blank auto-complete merge type, naming the parameter", () => {
    assert.throws(() => new HostPullRequest(item, [], [], [], false, "", -1, []), { name: "HostingArgumentException", parameterName: "commitCount" });
    assert.throws(() => new HostPullRequest(item, [], [], [], false, "", 1.5, []), { name: "HostingArgumentException", parameterName: "commitCount" });
    assert.throws(() => new HostPullRequest(item, [], [], [], true, "", null, [], " "), { name: "HostingArgumentException", parameterName: "autoCompleteMergeType" });
    assert.throws(() => new HostPullRequest(issue, [], [], [], false, "", null, []),
      { name: "HostingArgumentException", parameterName: "item", message: "The argument item is invalid: expected a pull request." });
  });

  it("refuses JSON with a field it doesn't define or an item that isn't a pull request, naming the field by its path", () => {
    assert.throws(() => HostPullRequest.fromJson({ ...pullRequest.toJson(), labels: [] }), { name: "HostingFieldException", field: "$.labels" });
    assert.throws(() => HostPullRequest.fromJson({ ...pullRequest.toJson(), item: issue.toJson() }), { name: "HostingFieldException", field: "$.item" });
    assert.throws(() => HostPullRequest.fromJson({ ...pullRequest.toJson(), builds: [{ ...build.toJson(), name: " " }] }),
      { name: "HostingFieldException", field: "$.builds.0.name" });
    assert.throws(() => HostPullRequest.fromJson({ ...pullRequest.toJson(), workItems: [{ ...workItem.toJson(), id: 0 }] }),
      { name: "HostingFieldException", field: "$.workItems.0.id" });
    assert.throws(() => HostPullRequest.fromJson({ ...pullRequest.toJson(), commitCount: "5" }), { name: "JsonException", path: "$.commitCount" });
    assert.throws(() => HostPullRequest.fromJson({ ...pullRequest.toJson(), autoCompleteMergeType: "" }), { name: "HostingFieldException", field: "$.autoCompleteMergeType" });
    assert.throws(() => HostPullRequest.fromJson({ ...pullRequest.toJson(), hasConflicts: "yes" }), { name: "JsonException", path: "$.hasConflicts" });
  });
});
