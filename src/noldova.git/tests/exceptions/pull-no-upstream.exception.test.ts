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
import { PullNoUpstreamException } from "../../src/exceptions/pull-no-upstream.exception.ts";

describe("PullNoUpstreamException", () => {
  test("carries its codes and message", () => {
    const error = new PullNoUpstreamException();

    assert.equal(error.name, "PullNoUpstreamException");
    assert.equal(error.message, "This branch has no upstream to pull from, or its upstream is gone. Publish it first.");
    assert.equal(error.code, FailureCode.Git);
    assert.equal(error.gitCode, GitCode.NoUpstream);
    assert.equal(error.output, null);
    assert.equal(error.cause, undefined);
    assert.ok(error instanceof GitFailureException);
  });
});
