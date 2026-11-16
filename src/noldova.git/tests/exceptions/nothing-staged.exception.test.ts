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
import { NothingStagedException } from "../../src/exceptions/nothing-staged.exception.ts";

describe("NothingStagedException", () => {
  test("carries its codes and message", () => {
    const error = new NothingStagedException();

    assert.equal(error.name, "NothingStagedException");
    assert.equal(error.message, "Nothing is staged to commit.");
    assert.equal(error.code, FailureCode.Git);
    assert.equal(error.gitCode, GitCode.NothingToCommit);
    assert.equal(error.output, null);
    assert.equal(error.cause, undefined);
    assert.ok(error instanceof GitFailureException);
  });
});
