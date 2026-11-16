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
import { RequestMovedException } from "../../src/exceptions/request-moved.exception.ts";

describe("RequestMovedException", () => {
  test("carries its codes and message", () => {
    const error = new RequestMovedException();

    assert.equal(error.name, "RequestMovedException");
    assert.equal(error.message, "What the request showed changed before the write ran, so nothing ran. Read the status again.");
    assert.equal(error.code, FailureCode.Stale);
    assert.equal(error.gitCode, null);
    assert.equal(error.output, null);
    assert.equal(error.cause, undefined);
    assert.ok(error instanceof GitFailureException);
  });
});
