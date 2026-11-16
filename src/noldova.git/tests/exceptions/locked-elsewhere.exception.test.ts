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
import { LockedElsewhereException } from "../../src/exceptions/locked-elsewhere.exception.ts";

describe("LockedElsewhereException", () => {
  test("carries its codes, message and facts", () => {
    const error = new LockedElsewhereException("/tmp/w");

    assert.equal(error.name, "LockedElsewhereException");
    assert.equal(error.message, "Another tool locked the worktree at /tmp/w, so the module leaves it alone.");
    assert.equal(error.code, FailureCode.Git);
    assert.equal(error.gitCode, GitCode.LockedElsewhere);
    assert.equal(error.folder, "/tmp/w");
    assert.equal(error.output, null);
    assert.equal(error.cause, undefined);
    assert.ok(error instanceof GitFailureException);
  });
});
