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
import { SkipMergeException } from "../../src/exceptions/skip-merge.exception.ts";

describe("SkipMergeException", () => {
  test("carries its codes and message", () => {
    const error = new SkipMergeException();

    assert.equal(error.name, "SkipMergeException");
    assert.equal(error.message, "A merge can't be skipped. Continue it once its files are resolved, or abort it.");
    assert.equal(error.code, FailureCode.Refused);
    assert.equal(error.gitCode, null);
    assert.equal(error.output, null);
    assert.equal(error.cause, undefined);
    assert.ok(error instanceof GitFailureException);
  });
});
