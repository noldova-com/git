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
import { ProgramTimedOutException } from "../../src/exceptions/program-timed-out.exception.ts";

describe("ProgramTimedOutException", () => {
  test("carries its codes, message and facts", () => {
    const error = new ProgramTimedOutException("git", 30_000);

    assert.equal(error.name, "ProgramTimedOutException");
    assert.equal(error.message, "git did not finish within 30000 ms, so it was stopped.");
    assert.equal(error.code, FailureCode.TimedOut);
    assert.equal(error.gitCode, null);
    assert.equal(error.program, "git");
    assert.equal(error.milliseconds, 30_000);
    assert.equal(error.output, null);
    assert.equal(error.cause, undefined);
    assert.ok(error instanceof GitFailureException);
  });
});
