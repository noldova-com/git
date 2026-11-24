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
import { PushRemoteAheadException } from "../../src/exceptions/push-remote-ahead.exception.ts";

describe("PushRemoteAheadException", () => {
  test("carries its codes, message and facts", () => {
    const output = { text: "! refs/heads/main:refs/heads/main [rejected] (fetch first)", source: UntrustedSource.Repository };

    const error = new PushRemoteAheadException(output);

    assert.equal(error.name, "PushRemoteAheadException");
    assert.equal(error.message, "The remote has commits this branch doesn't. Fetch, then push again; git's output comes with the failure as untrusted text.");
    assert.equal(error.code, FailureCode.Git);
    assert.equal(error.gitCode, GitCode.PushBehind);
    assert.deepEqual(error.output, output);
    assert.equal(error.cause, undefined);
    assert.ok(error instanceof GitFailureException);
  });
});
