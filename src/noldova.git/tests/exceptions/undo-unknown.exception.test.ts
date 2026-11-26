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
import { UndoUnknownException } from "../../src/exceptions/undo-unknown.exception.ts";

describe("UndoUnknownException", () => {
  test("carries its codes, message and facts", () => {
    const error = new UndoUnknownException();

    assert.equal(error.name, "UndoUnknownException");
    assert.equal(error.message, "The write to undo is no longer in the journal.");
    assert.equal(error.code, FailureCode.Stale);
    assert.equal(error.gitCode, null);
    assert.equal(error.output, null);
    assert.ok(error instanceof GitFailureException);
  });
});
