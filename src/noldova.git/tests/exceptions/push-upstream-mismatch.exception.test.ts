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
import { PushUpstreamMismatchException } from "../../src/exceptions/push-upstream-mismatch.exception.ts";

describe("PushUpstreamMismatchException", () => {
  test("carries its codes, message and facts", () => {
    const error = new PushUpstreamMismatchException("feat", "origin/main");

    assert.equal(error.name, "PushUpstreamMismatchException");
    assert.equal(error.message, "feat tracks origin/main, a branch of another name, and a push only goes to a branch of the same name. Set its upstream to one, or push it from a terminal.");
    assert.equal(error.code, FailureCode.Refused);
    assert.equal(error.gitCode, null);
    assert.deepEqual([error.branch, error.upstream], ["feat", "origin/main"]);
    assert.equal(error.output, null);
    assert.ok(error instanceof GitFailureException);
  });
});
