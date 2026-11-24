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

import { AmendNoCommitException } from "../../src/exceptions/amend-no-commit.exception.ts";
import { GitFailureException } from "../../src/exceptions/git-failure.exception.ts";

describe("AmendNoCommitException", () => {
  test("carries its codes, message and facts", () => {
    const error = new AmendNoCommitException();

    assert.equal(error.name, "AmendNoCommitException");
    assert.equal(error.message, "There is no commit yet to amend.");
    assert.equal(error.code, FailureCode.Refused);
    assert.equal(error.gitCode, null);
    assert.equal(error.output, null);
    assert.ok(error instanceof GitFailureException);
  });
});
