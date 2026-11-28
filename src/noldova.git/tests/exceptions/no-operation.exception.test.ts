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
import { NoOperationException } from "../../src/exceptions/no-operation.exception.ts";

describe("NoOperationException", () => {
  test("carries its codes and message", () => {
    const error = new NoOperationException();

    assert.equal(error.name, "NoOperationException");
    assert.equal(error.message, "No merge, rebase, cherry-pick or revert is in progress, so there is nothing to continue, skip or abort.");
    assert.equal(error.code, FailureCode.Stale);
    assert.equal(error.gitCode, null);
    assert.equal(error.output, null);
    assert.equal(error.cause, undefined);
    assert.ok(error instanceof GitFailureException);
  });
});
