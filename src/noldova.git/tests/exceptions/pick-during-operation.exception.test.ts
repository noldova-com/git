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
import { PickDuringOperationException } from "../../src/exceptions/pick-during-operation.exception.ts";

describe("PickDuringOperationException", () => {
  test("carries its codes, message and facts", () => {
    const error = new PickDuringOperationException();

    assert.equal(error.name, "PickDuringOperationException");
    assert.equal(error.message, "A merge, rebase, cherry-pick or revert is in progress, or a file has conflicts, so the module doesn't start another. Finish or abort it first.");
    assert.equal(error.code, FailureCode.Git);
    assert.equal(error.gitCode, GitCode.Conflict);
    assert.equal(error.output, null);
    assert.ok(error instanceof GitFailureException);
  });
});
