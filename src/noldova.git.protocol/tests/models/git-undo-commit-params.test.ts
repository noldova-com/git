/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";

import { describe, it } from "vitest";

import { GitUndoCommitParams } from "../../src/models/git-undo-commit-params.ts";
import type { IFieldFailure } from "../fixtures/field-failure.fixture.ts";

const expected = (field: string, expectation: string): IFieldFailure =>
  ({ name: "ProtocolFieldException", field, message: `The field ${field} is invalid: expected ${expectation}.` });

describe("GitUndoCommitParams", () => {
  it("keeps its folder and fingerprint, and reads back the same", () => {
    const params = new GitUndoCommitParams("/home/a/repo", "print");

    assert.deepEqual(params.toJson(), { folder: "/home/a/repo", basedOn: "print" });
    assert.deepEqual(GitUndoCommitParams.fromJson(JSON.parse(JSON.stringify(params.toJson()))), params);
  });

  it("refuses a relative folder and an empty fingerprint, naming its path", () => {
    assert.throws(() => GitUndoCommitParams.fromJson({ folder: "repo", basedOn: "p" }), expected("$.folder", "an absolute path of at most 4096 characters"));
    assert.throws(() => new GitUndoCommitParams("", "p"), expected("folder", "an absolute path of at most 4096 characters"));
    assert.throws(() => GitUndoCommitParams.fromJson({ folder: "/r", basedOn: "" }), expected("$.basedOn", "a text that isn't empty"));
  });

  it("refuses a missing fingerprint and a field it doesn't define", () => {
    assert.throws(() => GitUndoCommitParams.fromJson({ folder: "/r" }), { name: "JsonException", path: "$.basedOn" });
    assert.throws(() => GitUndoCommitParams.fromJson({ folder: "/r", basedOn: "p", more: 1 }), expected("$.more", "none, since the model doesn't define it"));
  });
});
