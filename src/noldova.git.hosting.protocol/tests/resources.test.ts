/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */


import assert from "node:assert/strict";

import { describe, it } from "vitest";

import { Resources } from "../src/resources.ts";

describe("The hosting protocol's Resources", () => {
  it("hold the expectations its models name in a refusal", () => {
    assert.deepEqual([
      Resources.unknownField, Resources.nonBlankTextExpected, Resources.httpsAddressExpected, Resources.positiveExpected, Resources.countExpected,
      Resources.nameExpected, Resources.pathExpected, Resources.commitExpected, Resources.pullRequestStateExpected, Resources.issueStateExpected,
      Resources.changesExpected, Resources.pullRequestExpected, Resources.checksExpected, Resources.reviewDecisionExpected,
      Resources.otherBranchExpected, Resources.avatarExpected,
      Resources.closedAtExpected, Resources.deviceCodeExpected, Resources.accountExpected, Resources.failureExpected, Resources.eachOnceExpected,
      Resources.voteExpected, Resources.finishedAtExpected, Resources.colorExpected, Resources.parentExpected,
      Resources.countsExpected
    ], [
      "none, since the model doesn't define it", "a text that isn't blank", "an https address with no user name or password", "a whole number above zero",
      "a whole number, zero or more", "a name of letters, digits, '.', '_' and '-', other than '.' and '..'",
      "names of letters, digits, '.', '_', '-' and percent escapes such as '%20' but not of '/' or '\\' joined by '/', none of them '.' or '..', '%2e' counting as a dot", "a full commit hash, 40 or 64 lowercase hexadecimal digits",
      "Open, Draft, Merged or Closed, the states of a pull request", "Open, ClosedDone or ClosedNotPlanned, the states of an issue",
      "changes exactly for a pull request", "a pull request", "no checks, since there is no pull request",
      "a review decision exactly for a pull request", "a branch other than the head branch",
      "a PNG, JPEG, GIF or WebP image of at most 64 KiB as a base64 data address", "a time exactly when the item is merged or closed",
      "either a device code or an address to open in the browser, exactly while the sign-in waits for the person", "an account exactly while signed in", "null, since only a sign-out has a failure",
      "each capability at most once", "a number from -1 to 1", "a finish time exactly when the build has finished, no earlier than its start",
      "a color of six hexadecimal digits", "a parent other than the work item itself",
      "zero counts when the host doesn't count them"
    ]);
    assert.equal(Resources.formatMemberExpected(["Queued", "Failed"]), "one of Queued, Failed");
  });

  it("hold the field names of the models' JSON", () => {
    assert.deepEqual([
      Resources.stateField, Resources.deviceCodeField, Resources.accountField, Resources.failureField, Resources.userCodeField, Resources.verificationUriField,
      Resources.expiresAtField, Resources.loginField, Resources.nameField, Resources.avatarField, Resources.scopesField, Resources.hostField, Resources.ownerField,
      Resources.repositoryField, Resources.numberField, Resources.referenceField, Resources.kindField, Resources.titleField, Resources.urlField,
      Resources.authorField, Resources.createdAtField, Resources.closedAtField, Resources.commentsField, Resources.changesField, Resources.additionsField,
      Resources.deletionsField, Resources.changedFilesField, Resources.headBranchField, Resources.baseBranchField, Resources.headCommitField,
      Resources.pathField, Resources.branchField, Resources.emailField, Resources.commitField, Resources.pullRequestField, Resources.checksField, Resources.reviewDecisionField, Resources.bodyField,
      Resources.isDraftField, Resources.capabilitiesField, Resources.personField, Resources.voteField, Resources.voteLabelField, Resources.isRequiredField,
      Resources.isBlockingField, Resources.startedAtField, Resources.finishedAtField, Resources.itemField, Resources.reviewersField, Resources.policiesField,
      Resources.buildsField, Resources.isAutoCompleteField, Resources.colorField, Resources.iconField, Resources.organizationField, Resources.projectField,
      Resources.idField, Resources.typeField, Resources.categoryField, Resources.assigneeField, Resources.iterationField, Resources.areaField,
      Resources.parentField
    ], [
      "state", "deviceCode", "account", "failure", "userCode", "verificationUri", "expiresAt", "login", "name", "avatar", "scopes", "host", "owner",
      "repository", "number", "reference", "kind", "title", "url", "author", "createdAt", "closedAt", "comments", "changes", "additions", "deletions",
      "changedFiles", "headBranch", "baseBranch", "headCommit", "path", "branch", "email", "commit", "pullRequest", "checks", "reviewDecision", "body", "isDraft",
      "capabilities", "person", "vote", "voteLabel", "isRequired", "isBlocking", "startedAt", "finishedAt", "item", "reviewers", "policies", "builds",
      "isAutoComplete", "color", "icon", "organization", "project", "id", "type", "category", "assignee", "iteration", "area", "parent"
    ]);
    assert.equal(Resources.httpsProtocol, "https:");
    assert.equal(Resources.maximumAvatarLength, 87_384);
  });

  it("match a host's names and paths, a full commit hash and a data image avatar", () => {
    assert.deepEqual(["a", "a.b-c_d", ".", "..", "a/b"].map(t => Resources.namePattern.test(t)), [true, true, false, false, false]);
    assert.deepEqual(["a/b", "a", "a//b", "a/..", "/a", "a/Sample%20Project", "a/%2e%2E", "a/b c"].map(t => Resources.pathPattern.test(t)),
      [true, true, false, false, false, true, false, false]);
    assert.deepEqual(["a".repeat(40), "a".repeat(64), "a".repeat(50), "A".repeat(40)].map(t => Resources.commitPattern.test(t)), [true, true, false, false]);
    assert.equal(Resources.avatarPattern.exec("data:image/webp;base64,UklG")?.[1], "UklG");
    assert.equal(Resources.avatarPattern.exec("data:image/bmp;base64,UklG"), null);
    assert.deepEqual(["009CCC", "abcdef", "#009CCC", "09C"].map(t => Resources.colorPattern.test(t)), [true, true, false, false]);
  });

  it("format a field's path, a refusal, a member's name and a reference", () => {
    assert.equal(Resources.formatFieldPath("$.account", "login"), "$.account.login");
    assert.equal(Resources.formatInvalidField("$.login", "a login"), "The field $.login is invalid: expected a login.");
    assert.equal(Resources.formatInvalidArgument("login", "a login"), "The argument login is invalid: expected a login.");
    assert.equal(Resources.formatMemberName("git-example", "signOut"), "git-example.signOut");
    assert.equal(Resources.formatReference("octocat", "hello-world", 7), "octocat/hello-world#7");
  });
});
