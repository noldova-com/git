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
import { UndoCommitPushedException } from "../../src/exceptions/undo-commit-pushed.exception.ts";

describe("UndoCommitPushedException", () => {
  test("carries its codes, message and facts", () => {
    const error = new UndoCommitPushedException();

    assert.equal(error.name, "UndoCommitPushedException");
    assert.equal(error.message, "The last commit is already on the branch's upstream; undoing it would change pushed history.");
    assert.equal(error.code, FailureCode.Refused);
    assert.equal(error.gitCode, null);
    assert.equal(error.output, null);
    assert.ok(error instanceof GitFailureException);
  });
});
