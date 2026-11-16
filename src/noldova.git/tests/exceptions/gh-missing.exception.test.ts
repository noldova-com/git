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

import { GhMissingException } from "../../src/exceptions/gh-missing.exception.ts";
import { GitFailureException } from "../../src/exceptions/git-failure.exception.ts";

describe("GhMissingException", () => {
  test("carries its codes, message, facts and cause", () => {
    const cause = new Error("The operation was aborted.");

    const error = new GhMissingException("gh", cause);

    assert.equal(error.name, "GhMissingException");
    assert.equal(error.message, "gh isn't found or can't be started.");
    assert.equal(error.code, FailureCode.Git);
    assert.equal(error.gitCode, GitCode.GhMissing);
    assert.equal(error.program, "gh");
    assert.equal(error.output, null);
    assert.equal(error.cause, cause);
    assert.ok(error instanceof GitFailureException);
  });
});
