/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";

import { describe, test } from "vitest";

import { FailureCode, GitCode } from "@noldova/git.protocol";

import { GitFailureException } from "../../src/exceptions/git-failure.exception.ts";
import { PushBehindException } from "../../src/exceptions/push-behind.exception.ts";

describe("PushBehindException", () => {
  test("carries its codes and message", () => {
    const error = new PushBehindException();

    assert.equal(error.name, "PushBehindException");
    assert.equal(error.message, "The upstream has commits the branch doesn't, as of the last fetch. Pull first, then push.");
    assert.equal(error.code, FailureCode.Git);
    assert.equal(error.gitCode, GitCode.PushBehind);
    assert.equal(error.output, null);
    assert.equal(error.cause, undefined);
    assert.ok(error instanceof GitFailureException);
  });
});
