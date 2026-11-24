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

import { CommitDuringOperationException } from "../../src/exceptions/commit-during-operation.exception.ts";
import { GitFailureException } from "../../src/exceptions/git-failure.exception.ts";

describe("CommitDuringOperationException", () => {
  test("carries its codes and message", () => {
    const error = new CommitDuringOperationException();

    assert.equal(error.name, "CommitDuringOperationException");
    assert.equal(error.message, "A merge, rebase, cherry-pick or revert is in progress, so an agent's commit isn't asked: git would take its author and parents from the operation. The person finishes it in the Git view, or aborts it.");
    assert.equal(error.code, FailureCode.Git);
    assert.equal(error.gitCode, GitCode.Conflict);
    assert.equal(error.output, null);
    assert.ok(error instanceof GitFailureException);
  });
});
