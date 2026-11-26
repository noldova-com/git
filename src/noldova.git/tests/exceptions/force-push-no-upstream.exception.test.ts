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

import { ForcePushNoUpstreamException } from "../../src/exceptions/force-push-no-upstream.exception.ts";
import { GitFailureException } from "../../src/exceptions/git-failure.exception.ts";

describe("ForcePushNoUpstreamException", () => {
  test("carries its codes, message and facts", () => {
    const error = new ForcePushNoUpstreamException();

    assert.equal(error.name, "ForcePushNoUpstreamException");
    assert.equal(error.message, "The branch has no upstream on its remote to replace.");
    assert.equal(error.code, FailureCode.Refused);
    assert.equal(error.gitCode, null);
    assert.equal(error.output, null);
    assert.ok(error instanceof GitFailureException);
  });
});
