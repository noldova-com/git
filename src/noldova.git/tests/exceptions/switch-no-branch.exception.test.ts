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
import { SwitchNoBranchException } from "../../src/exceptions/switch-no-branch.exception.ts";

describe("SwitchNoBranchException", () => {
  test("carries its codes, message and branch", () => {
    const error = new SwitchNoBranchException("feature");

    assert.equal(error.name, "SwitchNoBranchException");
    assert.equal(error.message, "There is no branch named feature here or on a remote, so there is nothing to switch to. Check the name, or fetch first.");
    assert.equal(error.code, FailureCode.Refused);
    assert.equal(error.gitCode, null);
    assert.equal(error.branch, "feature");
    assert.equal(error.output, null);
    assert.ok(error instanceof GitFailureException);
  });
});
