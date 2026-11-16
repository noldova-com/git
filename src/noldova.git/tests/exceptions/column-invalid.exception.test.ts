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

import { ColumnInvalidException } from "../../src/exceptions/column-invalid.exception.ts";
import { GitFailureException } from "../../src/exceptions/git-failure.exception.ts";

describe("ColumnInvalidException", () => {
  test("carries its codes, message and facts", () => {
    const error = new ColumnInvalidException("state");

    assert.equal(error.name, "ColumnInvalidException");
    assert.equal(error.message, "The module's worktree records hold an invalid state.");
    assert.equal(error.code, FailureCode.Unavailable);
    assert.equal(error.gitCode, null);
    assert.equal(error.column, "state");
    assert.equal(error.output, null);
    assert.equal(error.cause, undefined);
    assert.ok(error instanceof GitFailureException);
  });
});
