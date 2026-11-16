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

import { ChangesTooSlowException } from "../../src/exceptions/changes-too-slow.exception.ts";
import { GitFailureException } from "../../src/exceptions/git-failure.exception.ts";

describe("ChangesTooSlowException", () => {
  test("carries its codes, message and cause", () => {
    const cause = new Error("The operation was aborted.");

    const error = new ChangesTooSlowException(cause);

    assert.equal(error.name, "ChangesTooSlowException");
    assert.equal(error.message, "The worktree's changed files took too long to read, so the module can't ask to remove it.");
    assert.equal(error.code, FailureCode.TimedOut);
    assert.equal(error.gitCode, null);
    assert.equal(error.output, null);
    assert.equal(error.cause, cause);
    assert.ok(error instanceof GitFailureException);
  });
});
