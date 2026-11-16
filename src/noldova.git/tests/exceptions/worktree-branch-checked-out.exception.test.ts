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
import { WorktreeBranchCheckedOutException } from "../../src/exceptions/worktree-branch-checked-out.exception.ts";

describe("WorktreeBranchCheckedOutException", () => {
  test("carries its codes, message and facts", () => {
    const error = new WorktreeBranchCheckedOutException("noldova/a1");

    assert.equal(error.name, "WorktreeBranchCheckedOutException");
    assert.equal(error.message, "The branch noldova/a1 is already checked out in another worktree.");
    assert.equal(error.code, FailureCode.Git);
    assert.equal(error.gitCode, GitCode.BranchCheckedOut);
    assert.equal(error.branch, "noldova/a1");
    assert.equal(error.output, null);
    assert.equal(error.cause, undefined);
    assert.ok(error instanceof GitFailureException);
  });
});
