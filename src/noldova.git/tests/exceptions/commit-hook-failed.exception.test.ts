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

import { CommitHookFailedException } from "../../src/exceptions/commit-hook-failed.exception.ts";
import { GitFailureException } from "../../src/exceptions/git-failure.exception.ts";

describe("CommitHookFailedException", () => {
  test("carries its codes, message and facts", () => {
    const output = { text: "fatal: the remote said no", source: UntrustedSource.Repository };

    const error = new CommitHookFailedException(output);

    assert.equal(error.name, "CommitHookFailedException");
    assert.equal(error.message, "git commit failed, and the repository has hooks that can refuse a commit; their output comes with the failure as untrusted text.");
    assert.equal(error.code, FailureCode.Git);
    assert.equal(error.gitCode, GitCode.HookFailed);
    assert.deepEqual(error.output, output);
    assert.equal(error.cause, undefined);
    assert.ok(error instanceof GitFailureException);
  });
});
