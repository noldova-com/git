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

import { AmendPushedException } from "../../src/exceptions/amend-pushed.exception.ts";
import { GitFailureException } from "../../src/exceptions/git-failure.exception.ts";

describe("AmendPushedException", () => {
  test("carries its codes, message and facts", () => {
    const error = new AmendPushedException();

    assert.equal(error.name, "AmendPushedException");
    assert.equal(error.message, "The last commit is already on the branch's upstream, so amending it would rewrite pushed history. Make a new commit instead.");
    assert.equal(error.code, FailureCode.Refused);
    assert.equal(error.gitCode, null);
    assert.equal(error.output, null);
    assert.ok(error instanceof GitFailureException);
  });
});
