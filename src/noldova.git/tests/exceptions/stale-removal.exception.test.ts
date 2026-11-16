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
import { StaleRemovalException } from "../../src/exceptions/stale-removal.exception.ts";

describe("StaleRemovalException", () => {
  test("carries its codes and message", () => {
    const error = new StaleRemovalException();

    assert.equal(error.name, "StaleRemovalException");
    assert.equal(error.message, "The worktree changed after the request was answered, so it was kept. Ask again.");
    assert.equal(error.code, FailureCode.Stale);
    assert.equal(error.gitCode, null);
    assert.equal(error.output, null);
    assert.equal(error.cause, undefined);
    assert.ok(error instanceof GitFailureException);
  });
});
