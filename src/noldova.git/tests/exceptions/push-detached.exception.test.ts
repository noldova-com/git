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

import { GitFailureException } from "../../src/exceptions/git-failure.exception.ts";
import { PushDetachedException } from "../../src/exceptions/push-detached.exception.ts";

describe("PushDetachedException", () => {
  test("carries its codes and message", () => {
    const error = new PushDetachedException();

    assert.equal(error.name, "PushDetachedException");
    assert.equal(error.message, "HEAD is detached, so there's no branch to push. Switch to a branch first.");
    assert.equal(error.code, FailureCode.Refused);
    assert.equal(error.gitCode, null);
    assert.equal(error.output, null);
    assert.equal(error.cause, undefined);
    assert.ok(error instanceof GitFailureException);
  });
});
