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

import { BranchUnmergedException } from "../../src/exceptions/branch-unmerged.exception.ts";
import { GitFailureException } from "../../src/exceptions/git-failure.exception.ts";

describe("BranchUnmergedException", () => {
  test("carries its codes, message and facts", () => {
    const output = { text: "fatal: the remote said no", source: UntrustedSource.Repository };

    const error = new BranchUnmergedException("noldova/a1", output);

    assert.equal(error.name, "BranchUnmergedException");
    assert.equal(error.message, "The worktree was removed, but git kept its branch noldova/a1, which holds commits that aren't merged.");
    assert.equal(error.code, FailureCode.Git);
    assert.equal(error.gitCode, GitCode.BranchUnmerged);
    assert.equal(error.branch, "noldova/a1");
    assert.deepEqual(error.output, output);
    assert.equal(error.cause, undefined);
    assert.ok(error instanceof GitFailureException);
  });
});
