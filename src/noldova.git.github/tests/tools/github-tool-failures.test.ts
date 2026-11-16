/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";

import { Failure, FailureCode } from "@noldova/desktop.protocol";
import { MethodFailureException, PermissionDecision, ToolFailureCode, ToolFailureException } from "@noldova/desktop.runtime";
import { describe, it } from "vitest";

import { GitHubToolFailures } from "../../src/tools/github-tool-failures.ts";

function failureOf(error: unknown): readonly [ToolFailureCode, string, string | null] | null {
  return error instanceof ToolFailureException ? [error.failure.code, error.failure.message, error.failure.moduleCode] : null;
}

function methodFailure(code: FailureCode): MethodFailureException {
  return new MethodFailureException(new Failure(code, "GitHub said no."));
}

describe("GitHubToolFailures", () => {
  it("fails with the tool code, message and module code it is given, and as signed out with its own", () => {
    assert.deepEqual([failureOf(GitHubToolFailures.fail(ToolFailureCode.Refused, "No.", null)), failureOf(GitHubToolFailures.signedOut())], [
      [ToolFailureCode.Refused, "No.", null],
      [ToolFailureCode.Unavailable, "The person isn't signed in to GitHub; they sign in from the app's settings.", "git-github.signedOut"]]);
  });

  it("fails a permission that wasn't granted as Expired, Withdrawn or Denied, by the decision", () => {
    const decisions = [PermissionDecision.Expired, PermissionDecision.Withdrawn, PermissionDecision.Denied, PermissionDecision.DeniedAlways];

    assert.deepEqual(decisions.map(t => failureOf(GitHubToolFailures.notGranted(t))?.[0]),
      [ToolFailureCode.Expired, ToolFailureCode.Withdrawn, ToolFailureCode.Denied, ToolFailureCode.Denied]);
  });

  it("reads GitHub's failures as signed out, timed out, refused or unavailable, and passes on any other error as it is", () => {
    const other = new RangeError("Unexpected.");
    const errors = [FailureCode.Unauthorized, FailureCode.DeadlineExceeded, FailureCode.Conflict, FailureCode.Unavailable].map(methodFailure);

    assert.deepEqual(errors.map(t => failureOf(GitHubToolFailures.fromGitHub(t))), [
      [ToolFailureCode.Unavailable, "The person isn't signed in to GitHub; they sign in from the app's settings.", "git-github.signedOut"],
      [ToolFailureCode.TimedOut, "GitHub said no.", null],
      [ToolFailureCode.Refused, "GitHub said no.", "git-github.refused"],
      [ToolFailureCode.Unavailable, "GitHub said no.", "git-github.unavailable"]]);
    assert.equal(GitHubToolFailures.fromGitHub(other), other);
  });

  it("reads git's failures as not a repository or git unavailable, and passes on any other error as it is", () => {
    const other = new RangeError("Unexpected.");

    assert.deepEqual([methodFailure(FailureCode.NotFound), methodFailure(FailureCode.Internal)].map(t => failureOf(GitHubToolFailures.fromGit(t))), [
      [ToolFailureCode.Refused, "GitHub said no.", "git-github.notRepository"],
      [ToolFailureCode.Unavailable, "GitHub said no.", "git-github.gitUnavailable"]]);
    assert.equal(GitHubToolFailures.fromGit(other), other);
  });
});
