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
import { GitMissingException } from "../../src/exceptions/git-missing.exception.ts";

describe("GitMissingException", () => {
  test("carries its codes, message, facts and cause", () => {
    const cause = new Error("The operation was aborted.");

    const error = new GitMissingException("git", cause);

    assert.equal(error.name, "GitMissingException");
    assert.equal(error.message, "git isn't found or can't be started.");
    assert.equal(error.code, FailureCode.Git);
    assert.equal(error.gitCode, GitCode.GitMissing);
    assert.equal(error.program, "git");
    assert.equal(error.output, null);
    assert.equal(error.cause, cause);
    assert.ok(error instanceof GitFailureException);
  });
});
