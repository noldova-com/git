/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";

import { describe, test } from "vitest";

import { GitException } from "../../src/exceptions/git.exception.ts";
import { OutputLimitInvalidException } from "../../src/exceptions/output-limit-invalid.exception.ts";

describe("OutputLimitInvalidException", () => {
  test("carries its message and facts", () => {
    const error = new OutputLimitInvalidException(0);

    assert.equal(error.name, "OutputLimitInvalidException");
    assert.equal(error.message, "The output limit must be a whole number of bytes above zero.");
    assert.equal(error.outputBytes, 0);
    assert.equal(error.cause, undefined);
    assert.ok(error instanceof GitException);
  });
});
