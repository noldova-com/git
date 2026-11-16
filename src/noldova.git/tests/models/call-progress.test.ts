/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";
import { describe, test } from "vitest";

import { FailureCode, GitCode } from "@noldova/git.protocol";

import { WorktreeOutcomeUnknownException } from "../../src/exceptions/worktree-outcome-unknown.exception.ts";
import { WorktreeWithdrawnException } from "../../src/exceptions/worktree-withdrawn.exception.ts";
import { CallProgress } from "../../src/models/call-progress.ts";

describe("CallProgress", () => {
  const reason = new Error("Stopped.");

  test("gives the signal's reason for a cancel before it asks or writes", () => {
    assert.equal(new CallProgress(new AbortController().signal).cancelFailure(reason), reason);
  });

  test("fails a cancel while its request waits as withdrawn, and goes back to the reason once the answer came", async () => {
    const progress = new CallProgress(new AbortController().signal);
    const failures: unknown[] = [];

    await progress.askAsync(async () => {
      failures.push(progress.cancelFailure(reason));
    });

    const [failure] = failures;
    assert.ok(failure instanceof WorktreeWithdrawnException);
    assert.deepEqual({ ...failure }, { name: "WorktreeWithdrawnException", code: FailureCode.Withdrawn, gitCode: null, output: null });
    assert.equal(failure.message, "The call ended before its request was answered, so nothing changed.");
    assert.equal(failure.cause, reason);
    assert.equal(progress.cancelFailure(reason), reason);
  });

  test("stops asking when the request is refused", async () => {
    const progress = new CallProgress();

    await assert.rejects(progress.askAsync(() => Promise.reject(reason)), reason);

    assert.equal(progress.cancelFailure(reason), reason);
  });

  test("fails a cancel after a write started as an unknown outcome", () => {
    const progress = new CallProgress(new AbortController().signal);

    progress.startWriting();
    progress.startWriting();
    const failure = progress.cancelFailure(reason);

    assert.ok(failure instanceof WorktreeOutcomeUnknownException);
    assert.deepEqual({ ...failure }, { name: "WorktreeOutcomeUnknownException", code: FailureCode.Git, gitCode: GitCode.OutcomeUnknown, output: null });
    assert.equal(failure.message, "The call was cancelled while the worktree was changing. Read it again before trying again.");
    assert.equal(failure.cause, reason);
  });

  test("starts no write and raises no request once the signal aborted, and keeps writing once a write started", async () => {
    const cancel = new AbortController();
    const progress = new CallProgress(cancel.signal);
    cancel.abort(reason);

    assert.throws(() => progress.startWriting(), reason);
    await assert.rejects(progress.askAsync(async () => {}), reason);
    const later = new AbortController();
    const started = new CallProgress(later.signal);
    started.startWriting();
    later.abort(reason);
    assert.doesNotThrow(() => started.startWriting());
  });

  test("never stops a call with no signal", async () => {
    const progress = new CallProgress();

    assert.doesNotThrow(() => progress.startWriting());
    await progress.askAsync(async () => {});
  });
});
