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
import { UndoCommitRootException } from "../../src/exceptions/undo-commit-root.exception.ts";

describe("UndoCommitRootException", () => {
  test("carries its codes, message and facts", () => {
    const error = new UndoCommitRootException();

    assert.equal(error.name, "UndoCommitRootException");
    assert.equal(error.message, "The last commit is the branch's first, so there is no commit to go back to.");
    assert.equal(error.code, FailureCode.Refused);
    assert.equal(error.gitCode, null);
    assert.equal(error.output, null);
    assert.ok(error instanceof GitFailureException);
  });
});
