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
import { WorktreeListTruncatedException } from "../../src/exceptions/worktree-list-truncated.exception.ts";

describe("WorktreeListTruncatedException", () => {
  test("carries its codes and message", () => {
    const error = new WorktreeListTruncatedException();

    assert.equal(error.name, "WorktreeListTruncatedException");
    assert.equal(error.message, "The repository's worktree list is longer than the module reads.");
    assert.equal(error.code, FailureCode.Unavailable);
    assert.equal(error.gitCode, null);
    assert.equal(error.output, null);
    assert.equal(error.cause, undefined);
    assert.ok(error instanceof GitFailureException);
  });
});
