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
import { RequestTooLargeException } from "../../src/exceptions/request-too-large.exception.ts";

describe("RequestTooLargeException", () => {
  test("carries its codes and message", () => {
    const error = new RequestTooLargeException();

    assert.equal(error.name, "RequestTooLargeException");
    assert.equal(error.message, "The write is too large for a request to show exactly, so it wasn't asked and nothing ran.");
    assert.equal(error.code, FailureCode.Refused);
    assert.equal(error.gitCode, null);
    assert.equal(error.output, null);
    assert.equal(error.cause, undefined);
    assert.ok(error instanceof GitFailureException);
  });
});
