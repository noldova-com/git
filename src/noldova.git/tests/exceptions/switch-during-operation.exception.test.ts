/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";

import { describe, test } from "vitest";

import { FailureCode, GitCode } from "@noldova/git.protocol";

import { GitFailureException } from "../../src/exceptions/git-failure.exception.ts";
import { SwitchDuringOperationException } from "../../src/exceptions/switch-during-operation.exception.ts";

describe("SwitchDuringOperationException", () => {
  test("carries its codes and message", () => {
    const error = new SwitchDuringOperationException();

    assert.equal(error.name, "SwitchDuringOperationException");
    assert.equal(error.message, "A merge, rebase, cherry-pick or revert is in progress, so the module doesn't switch branches. Finish or abort it first.");
    assert.equal(error.code, FailureCode.Git);
    assert.equal(error.gitCode, GitCode.Conflict);
    assert.equal(error.output, null);
    assert.equal(error.cause, undefined);
    assert.ok(error instanceof GitFailureException);
  });
});
