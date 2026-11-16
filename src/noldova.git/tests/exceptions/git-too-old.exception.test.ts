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
import { GitTooOldException } from "../../src/exceptions/git-too-old.exception.ts";

describe("GitTooOldException", () => {
  test("carries its codes, message and facts", () => {
    const error = new GitTooOldException("2.34.1");

    assert.equal(error.name, "GitTooOldException");
    assert.equal(error.message, "The Git module needs git 2.39 or later.");
    assert.equal(error.code, FailureCode.Git);
    assert.equal(error.gitCode, GitCode.GitTooOld);
    assert.equal(error.gitVersion, "2.34.1");
    assert.equal(error.output, null);
    assert.equal(error.cause, undefined);
    assert.ok(error instanceof GitFailureException);
  });
});
