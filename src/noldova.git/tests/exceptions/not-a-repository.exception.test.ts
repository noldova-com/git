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
import { NotARepositoryException } from "../../src/exceptions/not-a-repository.exception.ts";

describe("NotARepositoryException", () => {
  test("carries its codes, message and facts", () => {
    const error = new NotARepositoryException("/tmp/a");

    assert.equal(error.name, "NotARepositoryException");
    assert.equal(error.message, "/tmp/a isn't inside a git repository with a working tree.");
    assert.equal(error.code, FailureCode.NotRepository);
    assert.equal(error.gitCode, null);
    assert.equal(error.folder, "/tmp/a");
    assert.equal(error.output, null);
    assert.equal(error.cause, undefined);
    assert.ok(error instanceof GitFailureException);
  });
});
