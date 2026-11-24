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
import { UndoMovedException } from "../../src/exceptions/undo-moved.exception.ts";

describe("UndoMovedException", () => {
  test("carries its codes, message and facts", () => {
    const error = new UndoMovedException();

    assert.equal(error.name, "UndoMovedException");
    assert.equal(error.message, "Something the write changed has moved since, so undoing it would lose that change.");
    assert.equal(error.code, FailureCode.Stale);
    assert.equal(error.gitCode, null);
    assert.equal(error.output, null);
    assert.ok(error instanceof GitFailureException);
  });
});
