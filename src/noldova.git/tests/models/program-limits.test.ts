/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";

import { describe, test } from "vitest";

import { OutputLimitInvalidException } from "../../src/exceptions/output-limit-invalid.exception.ts";
import { TimeLimitInvalidException } from "../../src/exceptions/time-limit-invalid.exception.ts";
import { ProgramLimits } from "../../src/models/program-limits.ts";

describe("ProgramLimits", () => {
  test("keeps whole limits above zero", () => {
    const limits = new ProgramLimits(1, 2);

    assert.equal(limits.outputBytes, 1);
    assert.equal(limits.milliseconds, 2);
  });

  test("refuses an output limit or a time limit that is not a whole number above zero", () => {
    for (const invalid of [0, -1, 1.5, Number.NaN, Number.MAX_SAFE_INTEGER + 1]) {
      assert.throws(() => new ProgramLimits(invalid, 1), (error: unknown) =>
        error instanceof OutputLimitInvalidException && /output limit/v.test(error.message) && Object.is(error.outputBytes, invalid));
      assert.throws(() => new ProgramLimits(1, invalid), (error: unknown) =>
        error instanceof TimeLimitInvalidException && /time limit/v.test(error.message) && Object.is(error.milliseconds, invalid));
    }
  });
});
