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
import { NothingToStashException } from "../../src/exceptions/nothing-to-stash.exception.ts";

describe("NothingToStashException", () => {
  test("carries its codes, message and facts", () => {
    const error = new NothingToStashException();

    assert.equal(error.name, "NothingToStashException");
    assert.equal(error.message, "There are no changes to stash.");
    assert.equal(error.code, FailureCode.Git);
    assert.equal(error.gitCode, GitCode.NothingToStash);
    assert.equal(error.output, null);
    assert.ok(error instanceof GitFailureException);
  });
});
