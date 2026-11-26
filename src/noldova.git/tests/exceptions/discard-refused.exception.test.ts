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

import { DiscardRefusedException } from "../../src/exceptions/discard-refused.exception.ts";
import { GitFailureException } from "../../src/exceptions/git-failure.exception.ts";

describe("DiscardRefusedException", () => {
  test("carries its codes, message and facts", () => {
    const error = new DiscardRefusedException("a.txt");

    assert.equal(error.name, "DiscardRefusedException");
    assert.equal(error.message, "a.txt has no change in the working folder that a discard can put back: it is unchanged, conflicted or a submodule. Read the status again.");
    assert.equal(error.code, FailureCode.Refused);
    assert.equal(error.gitCode, null);
    assert.equal(error.output, null);
    assert.ok(error instanceof GitFailureException);
  });
});
