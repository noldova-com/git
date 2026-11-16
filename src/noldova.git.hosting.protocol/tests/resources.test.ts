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
      Resources.changesExpected, Resources.pullRequestExpected, Resources.checksExpected, Resources.otherBranchExpected, Resources.avatarExpected,
      Resources.closedAtExpected, Resources.deviceCodeExpected, Resources.accountExpected, Resources.failureExpected
    ], [
      "none, since the model doesn't define it", "a text that isn't blank", "an https address with no user name or password", "a whole number above zero",
      "a whole number, zero or more", "a name of letters, digits, '.', '_' and '-', other than '.' and '..'",
      "names of letters, digits, '.', '_' and '-' joined by '/', none of them '.' or '..'", "a full commit hash, 40 or 64 lowercase hexadecimal digits",
      "Open, Draft, Merged or Closed, the states of a pull request", "Open, ClosedDone or ClosedNotPlanned, the states of an issue",
      "changes exactly for a pull request", "a pull request", "no checks, since there is no pull request", "a branch other than the head branch",
      "a PNG, JPEG, GIF or WebP image of at most 64 KiB as a base64 data address", "a time exactly when the item is merged or closed",
      "a device code exactly while the sign-in waits for the person", "an account exactly while signed in", "null, since only a sign-out has a failure"
    ]);
  });

  it("hold the field names of the models' JSON", () => {
    assert.deepEqual([
      Resources.stateField, Resources.deviceCodeField, Resources.accountField, Resources.failureField, Resources.userCodeField, Resources.verificationUriField,
      Resources.expiresAtField, Resources.loginField, Resources.nameField, Resources.avatarField, Resources.scopesField, Resources.hostField, Resources.ownerField,
      Resources.repositoryField, Resources.numberField, Resources.referenceField, Resources.kindField, Resources.titleField, Resources.urlField,
      Resources.authorField, Resources.createdAtField, Resources.closedAtField, Resources.commentsField, Resources.changesField, Resources.additionsField,
      Resources.deletionsField, Resources.changedFilesField, Resources.headBranchField, Resources.baseBranchField, Resources.headCommitField,
      Resources.pathField, Resources.branchField, Resources.pullRequestField, Resources.checksField, Resources.bodyField, Resources.isDraftField
    ], [
      "state", "deviceCode", "account", "failure", "userCode", "verificationUri", "expiresAt", "login", "name", "avatar", "scopes", "host", "owner",
      "repository", "number", "reference", "kind", "title", "url", "author", "createdAt", "closedAt", "comments", "changes", "additions", "deletions",
      "changedFiles", "headBranch", "baseBranch", "headCommit", "path", "branch", "pullRequest", "checks", "body", "isDraft"
    ]);
    assert.equal(Resources.httpsProtocol, "https:");
    assert.equal(Resources.maximumAvatarLength, 87_384);
  });

  it("match a host's names and paths, a full commit hash and a data image avatar", () => {
    assert.deepEqual(["a", "a.b-c_d", ".", "..", "a/b"].map(t => Resources.namePattern.test(t)), [true, true, false, false, false]);
    assert.deepEqual(["a/b", "a", "a//b", "a/..", "/a"].map(t => Resources.pathPattern.test(t)), [true, true, false, false, false]);
    assert.deepEqual(["a".repeat(40), "a".repeat(64), "a".repeat(50), "A".repeat(40)].map(t => Resources.commitPattern.test(t)), [true, true, false, false]);
    assert.equal(Resources.avatarPattern.exec("data:image/webp;base64,UklG")?.[1], "UklG");
    assert.equal(Resources.avatarPattern.exec("data:image/bmp;base64,UklG"), null);
  });

  it("format a field's path, a refusal, a member's name and a reference", () => {
    assert.equal(Resources.formatFieldPath("$.account", "login"), "$.account.login");
    assert.equal(Resources.formatInvalidField("$.login", "a login"), "The field $.login is invalid: expected a login.");
    assert.equal(Resources.formatInvalidArgument("login", "a login"), "The argument login is invalid: expected a login.");
    assert.equal(Resources.formatMemberName("git-example", "signOut"), "git-example.signOut");
    assert.equal(Resources.formatReference("octocat", "hello-world", 7), "octocat/hello-world#7");
  });
});
