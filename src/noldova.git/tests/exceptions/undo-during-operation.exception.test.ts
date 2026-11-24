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
import { UndoDuringOperationException } from "../../src/exceptions/undo-during-operation.exception.ts";

describe("UndoDuringOperationException", () => {
  test("carries its codes, message and facts", () => {
    const error = new UndoDuringOperationException();

    assert.equal(error.name, "UndoDuringOperationException");
    assert.equal(error.message, "Finish or abort the merge, rebase, cherry-pick or revert in progress before undoing a write.");
    assert.equal(error.code, FailureCode.Refused);
    assert.equal(error.gitCode, null);
    assert.equal(error.output, null);
    assert.ok(error instanceof GitFailureException);
  });
});
