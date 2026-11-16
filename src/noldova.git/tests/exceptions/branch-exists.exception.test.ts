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

import { BranchExistsException } from "../../src/exceptions/branch-exists.exception.ts";
import { GitFailureException } from "../../src/exceptions/git-failure.exception.ts";

describe("BranchExistsException", () => {
  test("carries its codes, message and facts", () => {
    const error = new BranchExistsException("topic");

    assert.equal(error.name, "BranchExistsException");
    assert.equal(error.message, "The branch topic already exists. Choose a new name.");
    assert.equal(error.code, FailureCode.Refused);
    assert.equal(error.gitCode, null);
    assert.equal(error.branch, "topic");
    assert.equal(error.output, null);
    assert.equal(error.cause, undefined);
    assert.ok(error instanceof GitFailureException);
  });
});
