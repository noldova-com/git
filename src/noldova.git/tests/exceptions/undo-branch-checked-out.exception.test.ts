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
import { UndoBranchCheckedOutException } from "../../src/exceptions/undo-branch-checked-out.exception.ts";

describe("UndoBranchCheckedOutException", () => {
  test("carries its codes, message and facts", () => {
    const error = new UndoBranchCheckedOutException("side", "/work/other");

    assert.equal(error.name, "UndoBranchCheckedOutException");
    assert.equal(error.message, "The branch side is checked out in the worktree /work/other, so undoing the write would change that worktree's files; switch it to another branch first.");
    assert.deepEqual([error.code, error.gitCode, error.output, error.branch, error.worktree], [FailureCode.Refused, null, null, "side", "/work/other"]);
    assert.ok(error instanceof GitFailureException);
  });
});
