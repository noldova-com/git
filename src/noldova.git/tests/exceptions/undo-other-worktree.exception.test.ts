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
import { UndoOtherWorktreeException } from "../../src/exceptions/undo-other-worktree.exception.ts";

describe("UndoOtherWorktreeException", () => {
  test("carries its codes, message and facts", () => {
    const error = new UndoOtherWorktreeException();

    assert.equal(error.name, "UndoOtherWorktreeException");
    assert.equal(error.message, "The write was made in another worktree of this repository, so it can only be undone there.");
    assert.equal(error.code, FailureCode.Refused);
    assert.equal(error.gitCode, null);
    assert.equal(error.output, null);
    assert.ok(error instanceof GitFailureException);
  });
});
