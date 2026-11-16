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
import { KeyRefusedException } from "../../src/exceptions/key-refused.exception.ts";

describe("KeyRefusedException", () => {
  test("carries its codes, message and facts", () => {
    const output = { text: "fatal: the remote said no", source: UntrustedSource.Repository };

    const error = new KeyRefusedException(output);

    assert.equal(error.name, "KeyRefusedException");
    assert.equal(error.message, "The remote refused your SSH key. Add your public key to the server, or load the right key into ssh-agent, then try again.");
    assert.equal(error.code, FailureCode.Git);
    assert.equal(error.gitCode, GitCode.KeyRefused);
    assert.deepEqual(error.output, output);
    assert.equal(error.cause, undefined);
    assert.ok(error instanceof GitFailureException);
  });
});
