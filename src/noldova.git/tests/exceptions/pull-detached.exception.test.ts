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
import { PullDetachedException } from "../../src/exceptions/pull-detached.exception.ts";

describe("PullDetachedException", () => {
  test("carries its codes and message", () => {
    const error = new PullDetachedException();

    assert.equal(error.name, "PullDetachedException");
    assert.equal(error.message, "HEAD isn't on a branch, so there's nothing to pull into.");
    assert.equal(error.code, FailureCode.Git);
    assert.equal(error.gitCode, GitCode.NoUpstream);
    assert.equal(error.output, null);
    assert.equal(error.cause, undefined);
    assert.ok(error instanceof GitFailureException);
  });
});
