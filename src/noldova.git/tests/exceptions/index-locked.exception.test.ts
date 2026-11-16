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
import { IndexLockedException } from "../../src/exceptions/index-locked.exception.ts";

describe("IndexLockedException", () => {
  test("carries its codes and message", () => {
    const error = new IndexLockedException();

    assert.equal(error.name, "IndexLockedException");
    assert.equal(error.message, "Another process holds the repository's index.lock. Let it finish, then try again.");
    assert.equal(error.code, FailureCode.Git);
    assert.equal(error.gitCode, GitCode.IndexLocked);
    assert.equal(error.output, null);
    assert.equal(error.cause, undefined);
    assert.ok(error instanceof GitFailureException);
  });
});
