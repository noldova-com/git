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
import { RequestExpiredException } from "../../src/exceptions/request-expired.exception.ts";

describe("RequestExpiredException", () => {
  test("carries its codes and message", () => {
    const error = new RequestExpiredException();

    assert.equal(error.name, "RequestExpiredException");
    assert.equal(error.message, "Nobody answered the request in time, so nothing ran.");
    assert.equal(error.code, FailureCode.Expired);
    assert.equal(error.gitCode, null);
    assert.equal(error.output, null);
    assert.equal(error.cause, undefined);
    assert.ok(error instanceof GitFailureException);
  });
});
