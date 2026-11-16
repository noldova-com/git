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

import { AlreadyOnBranchException } from "../../src/exceptions/already-on-branch.exception.ts";
import { GitFailureException } from "../../src/exceptions/git-failure.exception.ts";

describe("AlreadyOnBranchException", () => {
  test("carries its codes, message and facts", () => {
    const error = new AlreadyOnBranchException("main");

    assert.equal(error.name, "AlreadyOnBranchException");
    assert.equal(error.message, "HEAD is already on main.");
    assert.equal(error.code, FailureCode.Refused);
    assert.equal(error.gitCode, null);
    assert.equal(error.branch, "main");
    assert.equal(error.output, null);
    assert.equal(error.cause, undefined);
    assert.ok(error instanceof GitFailureException);
  });
});
