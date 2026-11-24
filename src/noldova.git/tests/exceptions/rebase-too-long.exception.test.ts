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
import { RebaseTooLongException } from "../../src/exceptions/rebase-too-long.exception.ts";

describe("RebaseTooLongException", () => {
  test("carries its codes, message and facts", () => {
    const error = new RebaseTooLongException();

    assert.equal(error.name, "RebaseTooLongException");
    assert.equal(error.message, "The branch has more commits past the base than an interactive rebase lists, so it wasn't read.");
    assert.equal(error.code, FailureCode.TooLarge);
    assert.equal(error.gitCode, null);
    assert.equal(error.output, null);
    assert.ok(error instanceof GitFailureException);
  });
});
