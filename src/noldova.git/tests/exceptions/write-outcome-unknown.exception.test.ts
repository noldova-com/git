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

import { GitFailureException } from "../../src/exceptions/git-failure.exception.ts";
import { WriteOutcomeUnknownException } from "../../src/exceptions/write-outcome-unknown.exception.ts";

describe("WriteOutcomeUnknownException", () => {
  test("carries its codes, message and cause", () => {
    const cause = new Error("The operation was aborted.");

    const error = new WriteOutcomeUnknownException(cause);

    assert.equal(error.name, "WriteOutcomeUnknownException");
    assert.equal(error.message, "The write was cancelled or ran out of time after git started, so whether it happened is unknown. Read the status again before any retry.");
    assert.equal(error.code, FailureCode.Git);
    assert.equal(error.gitCode, GitCode.OutcomeUnknown);
    assert.equal(error.output, null);
    assert.equal(error.cause, cause);
    assert.ok(error instanceof GitFailureException);
  });
});
