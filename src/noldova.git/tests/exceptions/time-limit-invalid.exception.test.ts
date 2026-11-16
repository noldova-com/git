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
import { TimeLimitInvalidException } from "../../src/exceptions/time-limit-invalid.exception.ts";

describe("TimeLimitInvalidException", () => {
  test("carries its message and facts", () => {
    const error = new TimeLimitInvalidException(1.5);

    assert.equal(error.name, "TimeLimitInvalidException");
    assert.equal(error.message, "The time limit must be a whole number of milliseconds above zero.");
    assert.equal(error.milliseconds, 1.5);
    assert.equal(error.cause, undefined);
    assert.ok(error instanceof GitException);
  });
});
