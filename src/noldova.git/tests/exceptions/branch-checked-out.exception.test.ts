/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";

import { describe, test } from "vitest";

import { FailureCode, GitCode, UntrustedSource } from "@noldova/git.protocol";

import { BranchCheckedOutException } from "../../src/exceptions/branch-checked-out.exception.ts";
import { GitFailureException } from "../../src/exceptions/git-failure.exception.ts";

describe("BranchCheckedOutException", () => {
  test("carries its codes, message and facts", () => {
    const output = { text: "fatal: the remote said no", source: UntrustedSource.Repository };

    const error = new BranchCheckedOutException("main", output);

    assert.equal(error.name, "BranchCheckedOutException");
    assert.equal(error.message, "main is checked out in another worktree, so git didn't switch to it.");
    assert.equal(error.code, FailureCode.Git);
    assert.equal(error.gitCode, GitCode.BranchCheckedOut);
    assert.equal(error.branch, "main");
    assert.deepEqual(error.output, output);
    assert.equal(error.cause, undefined);
    assert.ok(error instanceof GitFailureException);
  });
});
