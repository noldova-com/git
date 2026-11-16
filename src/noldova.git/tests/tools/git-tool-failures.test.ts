/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */
import assert from "node:assert/strict";

import { describe, test } from "vitest";

import { ModuleStoppingException, ToolFailureCode, ToolFailureException } from "@noldova/desktop.runtime";
import { ProtocolFieldException, UntrustedSource } from "@noldova/git.protocol";

import { ChangesTooLargeException } from "../../src/exceptions/changes-too-large.exception.ts";
import { FolderUnreadableException } from "../../src/exceptions/folder-unreadable.exception.ts";
import { GitFailedException } from "../../src/exceptions/git-failed.exception.ts";
import type { GitFailureException } from "../../src/exceptions/git-failure.exception.ts";
import { GitMissingException } from "../../src/exceptions/git-missing.exception.ts";
import { HooksUnreadableException } from "../../src/exceptions/hooks-unreadable.exception.ts";
import { IndexLockedException } from "../../src/exceptions/index-locked.exception.ts";
import { NotARepositoryException } from "../../src/exceptions/not-a-repository.exception.ts";
import { NothingStagedException } from "../../src/exceptions/nothing-staged.exception.ts";
import { NothingToPushException } from "../../src/exceptions/nothing-to-push.exception.ts";
import { OutputLimitInvalidException } from "../../src/exceptions/output-limit-invalid.exception.ts";
import { ProgramTimedOutException } from "../../src/exceptions/program-timed-out.exception.ts";
import { PushRejectedException } from "../../src/exceptions/push-rejected.exception.ts";
import { RequestDeniedException } from "../../src/exceptions/request-denied.exception.ts";
import { RequestExpiredException } from "../../src/exceptions/request-expired.exception.ts";
import { RequestWithdrawnException } from "../../src/exceptions/request-withdrawn.exception.ts";
import { StaleRemovalException } from "../../src/exceptions/stale-removal.exception.ts";
import { GitToolFailures } from "../../src/tools/git-tool-failures.ts";

describe("GitToolFailures", () => {
  const failureOf = (error: unknown, isSent: boolean = false, isStopped: boolean = false): readonly [ToolFailureCode, string | null, string] => {
    const failure = GitToolFailures.fromError(error, isSent, isStopped);
    assert.ok(failure instanceof ToolFailureException);
    return [failure.failure.code, failure.failure.moduleCode, failure.failure.message];
  };

  test("answers each of the module's codes with Noldova Desktop's tool code and the module code git.<camelCase>", () => {
    const cases: [GitFailureException, ToolFailureCode, string][] = [
      [new NothingToPushException(), ToolFailureCode.Refused, "git.refused"],
      [new RequestDeniedException(), ToolFailureCode.Denied, "git.denied"],
      [new RequestExpiredException(), ToolFailureCode.Expired, "git.expired"],
      [new RequestWithdrawnException(), ToolFailureCode.Withdrawn, "git.withdrawn"],
      [new StaleRemovalException(), ToolFailureCode.Stale, "git.stale"],
      [new ProgramTimedOutException("git", 1_000), ToolFailureCode.TimedOut, "git.timedOut"],
      [new ChangesTooLargeException(), ToolFailureCode.TooLarge, "git.tooLarge"],
      [new HooksUnreadableException(), ToolFailureCode.Unavailable, "git.unavailable"],
      [new NotARepositoryException("/work"), ToolFailureCode.Refused, "git.notRepository"],
      [new FolderUnreadableException("/work", new Error("EACCES")), ToolFailureCode.Unavailable, "git.folderUnreadable"],
      [new NothingStagedException(), ToolFailureCode.Refused, "git.nothingToCommit"],
      [new IndexLockedException(), ToolFailureCode.Unavailable, "git.indexLocked"],
      [new GitMissingException("git", new Error("spawn git ENOENT")), ToolFailureCode.Unavailable, "git.gitMissing"]
    ];
    for (const [error, toolCode, moduleCode] of cases)
      assert.deepEqual(failureOf(error), [toolCode, moduleCode, error.message], moduleCode);
  });

  test("fails a write past its point of no return as OutcomeUncertain when git, Noldova Desktop or a stop failed it, keeping the module code, and leaves any other error as it is", () => {
    const rejected = new PushRejectedException({ text: "rejected", source: UntrustedSource.Repository });
    assert.deepEqual(failureOf(rejected, true), [ToolFailureCode.OutcomeUncertain, "git.pushRejected", rejected.message]);
    assert.deepEqual(failureOf(new ModuleStoppingException("git", "git"), true).slice(0, 2), [ToolFailureCode.OutcomeUncertain, "git.outcomeUnknown"]);
    assert.deepEqual(failureOf(new Error("cancelled"), true, true).slice(0, 2), [ToolFailureCode.OutcomeUncertain, "git.outcomeUnknown"]);
    const bug = new TypeError("A bug after the write.");
    assert.equal(GitToolFailures.fromError(bug, true, false), bug);
  });

  test("refuses an argument the protocol refuses, and leaves any other error before the point of no return as it is", () => {
    assert.deepEqual(failureOf(new ProtocolFieldException("name", "a branch name")).slice(0, 2), [ToolFailureCode.Refused, "git.invalidArgument"]);
    const other = new Error("internal");
    assert.equal(GitToolFailures.fromError(other, false, true), other);
    const internal = new OutputLimitInvalidException(0);
    assert.equal(GitToolFailures.fromError(internal, false, false), internal);
  });

  test("carries git's output as the repository's untrusted text, cut past its limit", () => {
    const short = GitToolFailures.fromError(new GitFailedException("status", { text: "fatal: no\n", source: UntrustedSource.Repository }), false, false);
    assert.ok(short instanceof ToolFailureException);
    assert.deepEqual(short.failure.content.map(t => [t.value, t.origin, t.isUntrusted]), [["fatal: no\n", "git:repository", true]]);

    const long = GitToolFailures.fromError(new GitFailedException("status", { text: "x".repeat(70_000), source: UntrustedSource.Repository }), false, false);
    assert.ok(long instanceof ToolFailureException);
    assert.equal(long.failure.content[0]?.value, `${"x".repeat(65_536)}\n… (cut)`);
    assert.equal(GitToolFailures.originOf(UntrustedSource.GitHub), "git:github");
  });

  test("strips a URL's userinfo from the message and git's output, as the methods do", () => {
    const failed = GitToolFailures.fromError(new GitFailedException("push https://agent:token-1@example.invalid/r.git",
      { text: "fatal: unable to access 'https://agent:token-1@example.invalid/r.git/'\n", source: UntrustedSource.Repository }), true, false);
    assert.ok(failed instanceof ToolFailureException);
    assert.equal(failed.failure.message, "git push https://example.invalid/r.git failed; its output comes with the failure as untrusted text.");
    assert.deepEqual(failed.failure.content.map(t => t.value), ["fatal: unable to access 'https://example.invalid/r.git/'\n"]);

    const refused = GitToolFailures.fromError(new ProtocolFieldException("remote", "a URL like ssh://agent:token-1@example.invalid"), false, false);
    assert.ok(refused instanceof ToolFailureException);
    assert.equal(refused.failure.message.includes("token-1"), false);
  });
});
