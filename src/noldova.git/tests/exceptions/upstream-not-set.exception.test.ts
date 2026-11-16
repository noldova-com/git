/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";

import { describe, test } from "vitest";

import { FailureCode, UntrustedSource } from "@noldova/git.protocol";

import { GitFailureException } from "../../src/exceptions/git-failure.exception.ts";
import { UpstreamNotSetException } from "../../src/exceptions/upstream-not-set.exception.ts";

describe("UpstreamNotSetException", () => {
  test("carries its codes, message and facts", () => {
    const output = { text: "fatal: the remote said no", source: UntrustedSource.Repository };

    const error = new UpstreamNotSetException(output);

    assert.equal(error.name, "UpstreamNotSetException");
    assert.equal(error.message, "The push went through, but git couldn't set the remote branch as the branch's upstream; its output comes with the failure as untrusted text.");
    assert.equal(error.code, FailureCode.Unavailable);
    assert.equal(error.gitCode, null);
    assert.deepEqual(error.output, output);
    assert.equal(error.cause, undefined);
    assert.ok(error instanceof GitFailureException);
  });
});
