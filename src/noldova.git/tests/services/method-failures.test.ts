/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */
import assert from "node:assert/strict";

import { describe, test } from "vitest";

import { FailureCode as DesktopCode } from "@noldova/desktop.protocol";
import { MethodFailureException } from "@noldova/desktop.runtime";
import { FailureCode, GitCode, GitFolderParams, ProtocolFieldException } from "@noldova/git.protocol";

import { FolderUnreadableException } from "../../src/exceptions/folder-unreadable.exception.ts";
import { GitMissingException } from "../../src/exceptions/git-missing.exception.ts";
import { GitTooOldException } from "../../src/exceptions/git-too-old.exception.ts";
import { HooksUnreadableException } from "../../src/exceptions/hooks-unreadable.exception.ts";
import { IndexLockedException } from "../../src/exceptions/index-locked.exception.ts";
import { NotARepositoryException } from "../../src/exceptions/not-a-repository.exception.ts";
import { NothingToPushException } from "../../src/exceptions/nothing-to-push.exception.ts";
import { OutputLimitInvalidException } from "../../src/exceptions/output-limit-invalid.exception.ts";
import { ProgramTimedOutException } from "../../src/exceptions/program-timed-out.exception.ts";
import { StaleRemovalException } from "../../src/exceptions/stale-removal.exception.ts";
import { MethodFailures } from "../../src/services/method-failures.ts";

describe("MethodFailures", () => {
  const failureOf = (error: unknown): unknown => {
    const failure = MethodFailures.toMethodFailure(error);
    assert.ok(failure instanceof MethodFailureException);
    return { code: failure.failure.code, message: failure.failure.message, details: failure.failure.details };
  };

  test("answers each of the module's codes with Noldova Desktop's, and GitFailure in the details", () => {
    const cases = [
      [new StaleRemovalException(), FailureCode.Stale, null, DesktopCode.Conflict],
      [new NotARepositoryException("/work"), FailureCode.NotRepository, null, DesktopCode.NotFound],
      [new HooksUnreadableException(), FailureCode.Unavailable, null, DesktopCode.Unavailable],
      [new FolderUnreadableException("/work", new Error("EACCES")), FailureCode.Unavailable, GitCode.FolderUnreadable, DesktopCode.Unavailable],
      [new NothingToPushException(), FailureCode.Refused, null, DesktopCode.InvalidParams],
      [new ProgramTimedOutException("git", 1_000), FailureCode.TimedOut, null, DesktopCode.Internal],
      [new IndexLockedException(), FailureCode.Git, GitCode.IndexLocked, DesktopCode.Internal]
    ] as const;

    for (const [error, code, gitCode, desktop] of cases)
      assert.deepEqual(failureOf(error), { code: desktop, message: error.message, details: { code, gitCode, message: error.message, gitVersion: null } }, error.name);
  });

  test("answers a missing or old git as unavailable, keeping its Git code", () => {
    for (const [error, gitCode] of [[new GitMissingException("git", new Error("spawn git ENOENT")), GitCode.GitMissing], [new GitTooOldException(null), GitCode.GitTooOld]] as const)
      assert.deepEqual(failureOf(error), {
        code: DesktopCode.Unavailable,
        message: error.message,
        details: { code: FailureCode.Unavailable, gitCode, message: error.message, gitVersion: null }
      });
    assert.deepEqual(failureOf(new GitTooOldException("2.34.1")), {
      code: DesktopCode.Unavailable,
      message: "The Git module needs git 2.39 or later.",
      details: { code: FailureCode.Unavailable, gitCode: GitCode.GitTooOld, message: "The Git module needs git 2.39 or later.", gitVersion: "2.34.1" }
    });
  });

  test("answers parameters the protocol refuses as invalid, and leaves any other error as it is", () => {
    let refused: unknown = null;
    try {
      GitFolderParams.fromJson({ folder: "relative" });
    } catch (error) {
      refused = error;
    }
    assert.ok(refused instanceof ProtocolFieldException);
    assert.deepEqual(failureOf(refused), {
      code: DesktopCode.InvalidParams,
      message: refused.message,
      details: { code: FailureCode.Refused, gitCode: null, message: refused.message, gitVersion: null }
    });

    const other = new Error("Something else.");
    assert.equal(MethodFailures.toMethodFailure(other), other);
  });

  test("strips a URL's name, password or token from every message, keeping the rest of the URL", () => {
    assert.equal(MethodFailures.stripUserinfo("fatal: https://person:token-value@github.com/a/b.git and ssh://git@host/c and https://host/d"),
      "fatal: https://github.com/a/b.git and ssh://host/c and https://host/d");
    assert.equal(MethodFailures.stripUserinfo("1git+ssh://agent@host/r, ://user@host and ./https://x@y"), "1git+ssh://host/r, ://user@host and ./https://y");
    assert.deepEqual(failureOf(new NotARepositoryException("https://token@host/repo")), {
      code: DesktopCode.NotFound,
      message: "https://host/repo isn't inside a git repository with a working tree.",
      details: { code: FailureCode.NotRepository, gitCode: null, message: "https://host/repo isn't inside a git repository with a working tree.", gitVersion: null }
    });
  });

  test("leaves the module's own argument checks as they are, since they aren't wire failures", () => {
    const error = new OutputLimitInvalidException(0);
    assert.equal(MethodFailures.toMethodFailure(error), error);
  });
});
