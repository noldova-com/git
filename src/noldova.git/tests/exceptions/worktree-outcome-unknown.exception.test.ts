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
import { WorktreeOutcomeUnknownException } from "../../src/exceptions/worktree-outcome-unknown.exception.ts";

describe("WorktreeOutcomeUnknownException", () => {
  test("carries its codes, message and cause", () => {
    const cause = new Error("The operation was aborted.");

    const error = new WorktreeOutcomeUnknownException(cause);

    assert.equal(error.name, "WorktreeOutcomeUnknownException");
    assert.equal(error.message, "The call was cancelled while the worktree was changing. Read it again before trying again.");
    assert.equal(error.code, FailureCode.Git);
    assert.equal(error.gitCode, GitCode.OutcomeUnknown);
    assert.equal(error.output, null);
    assert.equal(error.cause, cause);
    assert.ok(error instanceof GitFailureException);
  });
});
