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
import { ResetNoCommitException } from "../../src/exceptions/reset-no-commit.exception.ts";

describe("ResetNoCommitException", () => {
  test("carries its codes, message and facts", () => {
    const error = new ResetNoCommitException();

    assert.equal(error.name, "ResetNoCommitException");
    assert.equal(error.message, "The branch has no commit yet.");
    assert.equal(error.code, FailureCode.Refused);
    assert.equal(error.gitCode, null);
    assert.equal(error.output, null);
    assert.ok(error instanceof GitFailureException);
  });
});
