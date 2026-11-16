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

import { FolderUnreadableException } from "../../src/exceptions/folder-unreadable.exception.ts";
import { GitFailureException } from "../../src/exceptions/git-failure.exception.ts";

describe("FolderUnreadableException", () => {
  test("carries its codes, message, facts and cause", () => {
    const cause = Object.assign(new Error("denied"), { code: "EACCES" });
    const error = new FolderUnreadableException("/tmp/a", cause);

    assert.equal(error.name, "FolderUnreadableException");
    assert.equal(error.message, "/tmp/a can't be read: your account doesn't have permission to open it.");
    assert.equal(error.code, FailureCode.Unavailable);
    assert.equal(error.gitCode, GitCode.FolderUnreadable);
    assert.equal(error.folder, "/tmp/a");
    assert.equal(error.output, null);
    assert.equal(error.cause, cause);
    assert.ok(error instanceof GitFailureException);
  });
});
