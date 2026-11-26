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
import { LinesRefusedException } from "../../src/exceptions/lines-refused.exception.ts";

describe("LinesRefusedException", () => {
  test("carries its codes, message and facts", () => {
    const error = new LinesRefusedException("Those lines changed since.");

    assert.equal(error.name, "LinesRefusedException");
    assert.equal(error.message, "Those lines changed since.");
    assert.equal(error.code, FailureCode.Refused);
    assert.equal(error.gitCode, null);
    assert.equal(error.output, null);
    assert.ok(error instanceof GitFailureException);
  });
});
