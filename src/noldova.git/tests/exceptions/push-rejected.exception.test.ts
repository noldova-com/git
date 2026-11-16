/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";

import { describe, test } from "vitest";

import { FailureCode, GitCode, UntrustedSource } from "@noldova/git.protocol";

import { GitFailureException } from "../../src/exceptions/git-failure.exception.ts";
import { PushRejectedException } from "../../src/exceptions/push-rejected.exception.ts";

describe("PushRejectedException", () => {
  test("carries its codes, message and facts", () => {
    const output = { text: "fatal: the remote said no", source: UntrustedSource.Repository };

    const error = new PushRejectedException(output);

    assert.equal(error.name, "PushRejectedException");
    assert.equal(error.message, "The remote refused the push; git's output comes with the failure as untrusted text.");
    assert.equal(error.code, FailureCode.Git);
    assert.equal(error.gitCode, GitCode.PushRejected);
    assert.deepEqual(error.output, output);
    assert.equal(error.cause, undefined);
    assert.ok(error instanceof GitFailureException);
  });
});
