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
import { KeyInOtherRepositoryException } from "../../src/exceptions/key-in-other-repository.exception.ts";

describe("KeyInOtherRepositoryException", () => {
  test("carries its codes and message", () => {
    const error = new KeyInOtherRepositoryException();

    assert.equal(error.name, "KeyInOtherRepositoryException");
    assert.equal(error.message, "This key already has a worktree in another repository.");
    assert.equal(error.code, FailureCode.Refused);
    assert.equal(error.gitCode, null);
    assert.equal(error.output, null);
    assert.equal(error.cause, undefined);
    assert.ok(error instanceof GitFailureException);
  });
});
