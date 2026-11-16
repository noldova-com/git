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
import { HooksUnreadableException } from "../../src/exceptions/hooks-unreadable.exception.ts";

describe("HooksUnreadableException", () => {
  test("carries its codes and message", () => {
    const error = new HooksUnreadableException();

    assert.equal(error.name, "HooksUnreadableException");
    assert.equal(error.message, "The repository's hooks couldn't be read.");
    assert.equal(error.code, FailureCode.Unavailable);
    assert.equal(error.gitCode, null);
    assert.equal(error.output, null);
    assert.equal(error.cause, undefined);
    assert.ok(error instanceof GitFailureException);
  });
});
