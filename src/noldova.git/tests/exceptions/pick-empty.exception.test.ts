/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";

import { describe, test } from "vitest";

import { FailureCode, UntrustedSource } from "@noldova/git.protocol";

import { GitFailureException } from "../../src/exceptions/git-failure.exception.ts";
import { PickEmptyException } from "../../src/exceptions/pick-empty.exception.ts";

describe("PickEmptyException", () => {
  test("carries its codes, message and facts", () => {
    const output = { text: "fatal: git said no", source: UntrustedSource.Repository };
    const error = new PickEmptyException(output);

    assert.equal(error.name, "PickEmptyException");
    assert.equal(error.message, "That commit's change is already here, so there is nothing to apply. Nothing changed.");
    assert.equal(error.code, FailureCode.Git);
    assert.equal(error.gitCode, null);
    assert.deepEqual(error.output, output);
    assert.ok(error instanceof GitFailureException);
  });
});
