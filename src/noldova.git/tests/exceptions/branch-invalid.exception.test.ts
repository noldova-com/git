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

import { BranchInvalidException } from "../../src/exceptions/branch-invalid.exception.ts";
import { GitFailureException } from "../../src/exceptions/git-failure.exception.ts";

describe("BranchInvalidException", () => {
  test("carries its codes, message and facts", () => {
    const error = new BranchInvalidException("a..b");

    assert.equal(error.name, "BranchInvalidException");
    assert.equal(error.message, "a..b isn't a valid branch name.");
    assert.equal(error.code, FailureCode.Refused);
    assert.equal(error.gitCode, null);
    assert.equal(error.branch, "a..b");
    assert.equal(error.output, null);
    assert.equal(error.cause, undefined);
    assert.ok(error instanceof GitFailureException);
  });
});
