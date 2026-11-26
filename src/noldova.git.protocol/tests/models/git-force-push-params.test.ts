/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";

import { describe, it } from "vitest";

import { GitForcePushParams } from "../../src/models/git-force-push-params.ts";
import type { IFieldFailure } from "../fixtures/field-failure.fixture.ts";

const expected = (field: string, expectation: string): IFieldFailure =>
  ({ name: "ProtocolFieldException", field, message: `The field ${field} is invalid: expected ${expectation}.` });

describe("GitForcePushParams", () => {
  const id = "0123456789abcdef0123456789abcdef01234567";

  it("keeps its folder, the remote commit it expects and the fingerprint, and reads back the same", () => {
    const params = new GitForcePushParams("/home/a/repo", id, "print");

    assert.deepEqual(params.toJson(), { folder: "/home/a/repo", expected: id, basedOn: "print" });
    assert.deepEqual(GitForcePushParams.fromJson(JSON.parse(JSON.stringify(params.toJson()))), params);
  });

  it("refuses a relative folder, an expected commit that isn't a full id and an empty fingerprint, naming its path", () => {
    assert.throws(() => GitForcePushParams.fromJson({ folder: "repo", expected: id, basedOn: "p" }), expected("$.folder", "an absolute path of at most 4096 characters"));
    assert.throws(() => GitForcePushParams.fromJson({ folder: "/r", expected: "main", basedOn: "p" }), expected("$.expected", "a full hexadecimal object id"));
    assert.throws(() => new GitForcePushParams("/r", id.slice(1), "p"), expected("expected", "a full hexadecimal object id"));
    assert.throws(() => GitForcePushParams.fromJson({ folder: "/r", expected: id, basedOn: "" }), expected("$.basedOn", "a text that isn't empty"));
  });

  it("refuses a missing fingerprint and a field it doesn't define", () => {
    assert.throws(() => GitForcePushParams.fromJson({ folder: "/r", expected: id }), { name: "JsonException", path: "$.basedOn" });
    assert.throws(() => GitForcePushParams.fromJson({ folder: "/r", expected: id, basedOn: "p", more: 1 }),
      expected("$.more", "none, since the model doesn't define it"));
  });
});
