/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";

import { describe, test } from "vitest";

import { FolderNotAbsoluteException } from "../../src/exceptions/folder-not-absolute.exception.ts";
import { GitException } from "../../src/exceptions/git.exception.ts";

describe("FolderNotAbsoluteException", () => {
  test("carries its message and facts", () => {
    const error = new FolderNotAbsoluteException("working folder", "relative");

    assert.equal(error.name, "FolderNotAbsoluteException");
    assert.equal(error.message, "The working folder must be an absolute path.");
    assert.equal(error.label, "working folder");
    assert.equal(error.folder, "relative");
    assert.equal(error.cause, undefined);
    assert.ok(error instanceof GitException);
  });
});
