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
import { RepositoryNotAbsoluteException } from "../../src/exceptions/repository-not-absolute.exception.ts";

describe("RepositoryNotAbsoluteException", () => {
  test("carries its codes, message and facts", () => {
    const error = new RepositoryNotAbsoluteException("relative");

    assert.equal(error.name, "RepositoryNotAbsoluteException");
    assert.equal(error.message, "The repository must be an absolute path.");
    assert.equal(error.code, FailureCode.Refused);
    assert.equal(error.gitCode, null);
    assert.equal(error.folder, "relative");
    assert.equal(error.output, null);
    assert.equal(error.cause, undefined);
    assert.ok(error instanceof GitFailureException);
  });
});
