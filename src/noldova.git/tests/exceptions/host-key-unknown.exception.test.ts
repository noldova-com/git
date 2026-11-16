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
import { HostKeyUnknownException } from "../../src/exceptions/host-key-unknown.exception.ts";

describe("HostKeyUnknownException", () => {
  test("carries its codes, message and facts", () => {
    const output = { text: "fatal: the remote said no", source: UntrustedSource.Repository };

    const error = new HostKeyUnknownException(output);

    assert.equal(error.name, "HostKeyUnknownException");
    assert.equal(error.message, "Git doesn't know the remote's host key, or it changed, so it stopped. The module never trusts a host key for you: check the key on the server, then connect once from your terminal.");
    assert.equal(error.code, FailureCode.Git);
    assert.equal(error.gitCode, GitCode.HostKeyUnknown);
    assert.deepEqual(error.output, output);
    assert.equal(error.cause, undefined);
    assert.ok(error instanceof GitFailureException);
  });
});
