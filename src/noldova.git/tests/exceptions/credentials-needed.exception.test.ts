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

import { CredentialsNeededException } from "../../src/exceptions/credentials-needed.exception.ts";
import { GitFailureException } from "../../src/exceptions/git-failure.exception.ts";

describe("CredentialsNeededException", () => {
  test("carries its codes, message and facts", () => {
    const output = { text: "fatal: the remote said no", source: UntrustedSource.Repository };

    const error = new CredentialsNeededException(output);

    assert.equal(error.name, "CredentialsNeededException");
    assert.equal(error.message, "The remote asked for a name or password, and Git has no credential helper to answer it without a terminal. Set one up, such as Git Credential Manager.");
    assert.equal(error.code, FailureCode.Git);
    assert.equal(error.gitCode, GitCode.CredentialsNeeded);
    assert.deepEqual(error.output, output);
    assert.equal(error.cause, undefined);
    assert.ok(error instanceof GitFailureException);
  });
});
