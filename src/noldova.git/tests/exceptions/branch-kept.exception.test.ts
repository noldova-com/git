/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";

import { describe, test } from "vitest";

import { FailureCode, UntrustedSource } from "@noldova/git.protocol";

import { BranchKeptException } from "../../src/exceptions/branch-kept.exception.ts";
import { GitFailureException } from "../../src/exceptions/git-failure.exception.ts";

describe("BranchKeptException", () => {
  test("carries its codes, message and facts", () => {
    const output = { text: "fatal: the remote said no", source: UntrustedSource.Repository };

    const error = new BranchKeptException("noldova/a1", output);

    assert.equal(error.name, "BranchKeptException");
    assert.equal(error.message, "The worktree was removed, but git kept its branch noldova/a1; git's output says why.");
    assert.equal(error.code, FailureCode.Unavailable);
    assert.equal(error.gitCode, null);
    assert.equal(error.branch, "noldova/a1");
    assert.deepEqual(error.output, output);
    assert.equal(error.cause, undefined);
    assert.ok(error instanceof GitFailureException);
  });
});
