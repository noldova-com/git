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
import { PullConflictsException } from "../../src/exceptions/pull-conflicts.exception.ts";

describe("PullConflictsException", () => {
  test("carries its codes and message", () => {
    const error = new PullConflictsException();

    assert.equal(error.name, "PullConflictsException");
    assert.equal(error.message, "Finish the merge or other operation in progress, and resolve and stage its conflicts, before pulling.");
    assert.equal(error.code, FailureCode.Git);
    assert.equal(error.gitCode, GitCode.Conflict);
    assert.equal(error.output, null);
    assert.equal(error.cause, undefined);
    assert.ok(error instanceof GitFailureException);
  });
});
