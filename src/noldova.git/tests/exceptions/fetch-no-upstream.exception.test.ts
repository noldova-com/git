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

import { FetchNoUpstreamException } from "../../src/exceptions/fetch-no-upstream.exception.ts";
import { GitFailureException } from "../../src/exceptions/git-failure.exception.ts";

describe("FetchNoUpstreamException", () => {
  test("carries its codes, message and facts", () => {
    const error = new FetchNoUpstreamException();

    assert.equal(error.name, "FetchNoUpstreamException");
    assert.equal(error.message, "This branch has no upstream to fetch, or its upstream is gone. Publish it first.");
    assert.equal(error.code, FailureCode.Git);
    assert.equal(error.gitCode, GitCode.NoUpstream);
    assert.equal(error.output, null);
    assert.ok(error instanceof GitFailureException);
  });
});
