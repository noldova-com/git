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
import { UnreadableOutputException } from "../../src/exceptions/unreadable-output.exception.ts";

describe("UnreadableOutputException", () => {
  test("carries its codes, message, facts and cause", () => {
    const cause = new Error("The operation was aborted.");

    const error = new UnreadableOutputException("log", "commits", cause);

    assert.equal(error.name, "UnreadableOutputException");
    assert.equal(error.message, "git log printed commits that the module can't read.");
    assert.equal(error.code, FailureCode.Git);
    assert.equal(error.gitCode, GitCode.UnreadableOutput);
    assert.equal(error.command, "log");
    assert.equal(error.part, "commits");
    assert.equal(error.output, null);
    assert.equal(error.cause, cause);
    assert.ok(error instanceof GitFailureException);
  });

  test("has no cause when it is given none", () => {
    assert.equal(new UnreadableOutputException("log", "commits").cause, undefined);
  });
});
