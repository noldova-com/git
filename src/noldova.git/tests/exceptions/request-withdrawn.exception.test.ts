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
import { RequestWithdrawnException } from "../../src/exceptions/request-withdrawn.exception.ts";

describe("RequestWithdrawnException", () => {
  test("carries its codes and message", () => {
    const error = new RequestWithdrawnException();

    assert.equal(error.name, "RequestWithdrawnException");
    assert.equal(error.message, "The call was cancelled before the person answered, so nothing ran.");
    assert.equal(error.code, FailureCode.Withdrawn);
    assert.equal(error.gitCode, null);
    assert.equal(error.output, null);
    assert.equal(error.cause, undefined);
    assert.ok(error instanceof GitFailureException);
  });
});
