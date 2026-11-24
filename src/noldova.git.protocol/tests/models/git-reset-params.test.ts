/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";

import { describe, it } from "vitest";

import { ResetMode } from "../../src/enums/reset-mode.ts";
import { GitResetParams } from "../../src/models/git-reset-params.ts";

const expected = (field: string, expectation: string): { name: string; field: string; message: string } =>
  ({ name: "ProtocolFieldException", field, message: `The field ${field} is invalid: expected ${expectation}.` });

describe("GitResetParams", () => {
  const id = "0123456789abcdef0123456789abcdef01234567";

  it("keeps its folder, commit, mode and fingerprint, and reads back the same for each mode", () => {
    const params = new GitResetParams("/home/a/repo", id, ResetMode.Keep, "print");

    assert.deepEqual(params.toJson(), { folder: "/home/a/repo", id, mode: "Keep", basedOn: "print" });
    for (const mode of [ResetMode.Soft, ResetMode.Mixed, ResetMode.Keep]) {
      const each = new GitResetParams("/r", id, mode, "p");
      assert.deepEqual(GitResetParams.fromJson(JSON.parse(JSON.stringify(each.toJson()))), each);
    }
  });

  it("refuses a relative folder, an id that isn't a full object id and an empty fingerprint, naming its path", () => {
    assert.throws(() => GitResetParams.fromJson({ folder: "repo", id, mode: "Soft", basedOn: "p" }), expected("$.folder", "an absolute path of at most 4096 characters"));
    assert.throws(() => GitResetParams.fromJson({ folder: "/r", id: "HEAD~1", mode: "Soft", basedOn: "p" }), expected("$.id", "a full hexadecimal object id"));
    assert.throws(() => GitResetParams.fromJson({ folder: "/r", id, mode: "Soft", basedOn: "" }), expected("$.basedOn", "a text that isn't empty"));
    assert.throws(() => new GitResetParams("/r", id, ResetMode.Mixed, ""), expected("basedOn", "a text that isn't empty"));
  });

  it("refuses an unknown mode and a field it doesn't define", () => {
    assert.throws(() => GitResetParams.fromJson({ folder: "/r", id, mode: "Hard", basedOn: "p" }), { name: "JsonException", path: "$.mode" });
    assert.throws(() => GitResetParams.fromJson({ folder: "/r", id, mode: "Soft", basedOn: "p", more: 1 }), expected("$.more", "none, since the model doesn't define it"));
  });
});
