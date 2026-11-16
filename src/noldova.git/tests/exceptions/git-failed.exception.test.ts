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

import { GitFailedException } from "../../src/exceptions/git-failed.exception.ts";
import { GitFailureException } from "../../src/exceptions/git-failure.exception.ts";

describe("GitFailedException", () => {
  test("carries its codes, message and facts", () => {
    const output = { text: "fatal: the remote said no", source: UntrustedSource.Repository };

    const error = new GitFailedException("status", output);

    assert.equal(error.name, "GitFailedException");
    assert.equal(error.message, "git status failed; its output comes with the failure as untrusted text.");
    assert.equal(error.code, FailureCode.Unavailable);
    assert.equal(error.gitCode, null);
    assert.equal(error.command, "status");
    assert.deepEqual(error.output, output);
    assert.equal(error.cause, undefined);
    assert.ok(error instanceof GitFailureException);
  });
});
