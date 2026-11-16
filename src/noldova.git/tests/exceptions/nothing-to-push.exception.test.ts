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
import { NothingToPushException } from "../../src/exceptions/nothing-to-push.exception.ts";

describe("NothingToPushException", () => {
  test("carries its codes and message", () => {
    const error = new NothingToPushException();

    assert.equal(error.name, "NothingToPushException");
    assert.equal(error.message, "The branch has no commits that its upstream doesn't have.");
    assert.equal(error.code, FailureCode.Refused);
    assert.equal(error.gitCode, null);
    assert.equal(error.output, null);
    assert.equal(error.cause, undefined);
    assert.ok(error instanceof GitFailureException);
  });
});
