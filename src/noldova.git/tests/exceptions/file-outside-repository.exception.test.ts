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

import { FileOutsideRepositoryException } from "../../src/exceptions/file-outside-repository.exception.ts";
import { GitFailureException } from "../../src/exceptions/git-failure.exception.ts";

describe("FileOutsideRepositoryException", () => {
  test("carries its codes and message", () => {
    const error = new FileOutsideRepositoryException();

    assert.equal(error.name, "FileOutsideRepositoryException");
    assert.equal(error.message, "The file's folder leads outside the repository, so the module doesn't write it. Nothing changed.");
    assert.equal(error.code, FailureCode.Refused);
    assert.equal(error.gitCode, null);
    assert.equal(error.output, null);
    assert.equal(error.cause, undefined);
    assert.ok(error instanceof GitFailureException);
  });
});
