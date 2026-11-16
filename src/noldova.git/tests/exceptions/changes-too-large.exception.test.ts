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

import { ChangesTooLargeException } from "../../src/exceptions/changes-too-large.exception.ts";
import { GitFailureException } from "../../src/exceptions/git-failure.exception.ts";

describe("ChangesTooLargeException", () => {
  test("carries its codes and message", () => {
    const error = new ChangesTooLargeException();

    assert.equal(error.name, "ChangesTooLargeException");
    assert.equal(error.message, "The worktree has more changes than the module reads, so it can't ask to remove it.");
    assert.equal(error.code, FailureCode.TooLarge);
    assert.equal(error.gitCode, null);
    assert.equal(error.output, null);
    assert.equal(error.cause, undefined);
    assert.ok(error instanceof GitFailureException);
  });
});
