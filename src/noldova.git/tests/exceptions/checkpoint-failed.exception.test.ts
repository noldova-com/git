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

import { CheckpointFailedException } from "../../src/exceptions/checkpoint-failed.exception.ts";
import { GitFailureException } from "../../src/exceptions/git-failure.exception.ts";

describe("CheckpointFailedException", () => {
  test("carries its codes, message and facts", () => {
    const error = new CheckpointFailedException("The checkpoint could not be saved.");

    assert.equal(error.name, "CheckpointFailedException");
    assert.equal(error.message, "The checkpoint could not be saved.");
    assert.equal(error.code, FailureCode.Unavailable);
    assert.equal(error.gitCode, null);
    assert.equal(error.output, null);
    assert.ok(error instanceof GitFailureException);
  });
});
