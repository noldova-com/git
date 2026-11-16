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

import { BaseInvalidException } from "../../src/exceptions/base-invalid.exception.ts";
import { GitFailureException } from "../../src/exceptions/git-failure.exception.ts";

describe("BaseInvalidException", () => {
  test("carries its codes, message and facts", () => {
    const error = new BaseInvalidException("v9");

    assert.equal(error.name, "BaseInvalidException");
    assert.equal(error.message, "v9 isn't a commit in the repository.");
    assert.equal(error.code, FailureCode.Refused);
    assert.equal(error.gitCode, null);
    assert.equal(error.base, "v9");
    assert.equal(error.output, null);
    assert.equal(error.cause, undefined);
    assert.ok(error instanceof GitFailureException);
  });
});
