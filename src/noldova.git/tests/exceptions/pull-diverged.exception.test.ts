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
import { PullDivergedException } from "../../src/exceptions/pull-diverged.exception.ts";

describe("PullDivergedException", () => {
  test("carries its codes and message", () => {
    const error = new PullDivergedException();

    assert.equal(error.name, "PullDivergedException");
    assert.equal(error.message, "This branch and its upstream each have commits the other doesn't, so a pull can't fast-forward it. Merge or rebase it: in History, drag the upstream onto the branch.");
    assert.equal(error.code, FailureCode.Git);
    assert.equal(error.gitCode, GitCode.Diverged);
    assert.equal(error.output, null);
    assert.equal(error.cause, undefined);
    assert.ok(error instanceof GitFailureException);
  });
});
