/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";

import { describe, test } from "vitest";

import { FailureCode } from "@noldova/git.protocol";

import { GitFailureException } from "../../src/exceptions/git-failure.exception.ts";
import { WorktreeWithdrawnException } from "../../src/exceptions/worktree-withdrawn.exception.ts";

describe("WorktreeWithdrawnException", () => {
  test("carries its codes, message and cause", () => {
    const cause = new Error("The operation was aborted.");

    const error = new WorktreeWithdrawnException(cause);

    assert.equal(error.name, "WorktreeWithdrawnException");
    assert.equal(error.message, "The call ended before its request was answered, so nothing changed.");
    assert.equal(error.code, FailureCode.Withdrawn);
    assert.equal(error.gitCode, null);
    assert.equal(error.output, null);
    assert.equal(error.cause, cause);
    assert.ok(error instanceof GitFailureException);
  });
});
