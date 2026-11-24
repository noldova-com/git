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
import { ResetDuringOperationException } from "../../src/exceptions/reset-during-operation.exception.ts";

describe("ResetDuringOperationException", () => {
  test("carries its codes, message and facts", () => {
    const error = new ResetDuringOperationException();

    assert.equal(error.name, "ResetDuringOperationException");
    assert.equal(error.message, "Finish or abort the merge, rebase, cherry-pick or revert in progress before resetting.");
    assert.equal(error.code, FailureCode.Refused);
    assert.equal(error.gitCode, null);
    assert.equal(error.output, null);
    assert.ok(error instanceof GitFailureException);
  });
});
