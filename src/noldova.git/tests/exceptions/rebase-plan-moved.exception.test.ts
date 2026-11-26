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
import { RebasePlanMovedException } from "../../src/exceptions/rebase-plan-moved.exception.ts";

describe("RebasePlanMovedException", () => {
  test("carries its codes, message and facts", () => {
    const error = new RebasePlanMovedException();

    assert.equal(error.name, "RebasePlanMovedException");
    assert.equal(error.message, "The branch has moved since its rebase plan was read, so its steps no longer match the commits to rebase; read the plan again.");
    assert.equal(error.code, FailureCode.Stale);
    assert.equal(error.gitCode, null);
    assert.equal(error.output, null);
    assert.ok(error instanceof GitFailureException);
  });
});
