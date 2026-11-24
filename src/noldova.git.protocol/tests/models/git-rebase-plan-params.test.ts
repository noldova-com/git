/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";

import { describe, it } from "vitest";

import { GitRebasePlanParams } from "../../src/models/git-rebase-plan-params.ts";

const expected = (field: string, expectation: string): { name: string; field: string; message: string } =>
  ({ name: "ProtocolFieldException", field, message: `The field ${field} is invalid: expected ${expectation}.` });

describe("GitRebasePlanParams", () => {
  const onto = "c".repeat(40);

  it("keeps its folder and target, and reads back the same", () => {
    const params = new GitRebasePlanParams("/home/a/repo", onto);

    assert.deepEqual(params.toJson(), { folder: "/home/a/repo", onto });
    assert.deepEqual(GitRebasePlanParams.fromJson(JSON.parse(JSON.stringify(params.toJson()))), params);
  });

  it("refuses a relative folder and a target that isn't a full id, naming its path", () => {
    assert.throws(() => GitRebasePlanParams.fromJson({ folder: "repo", onto }), expected("$.folder", "an absolute path of at most 4096 characters"));
    assert.throws(() => GitRebasePlanParams.fromJson({ folder: "/r", onto: "main" }), expected("$.onto", "a full hexadecimal object id"));
    assert.throws(() => new GitRebasePlanParams("/r", "C".repeat(40)), expected("onto", "a full hexadecimal object id"));
  });

  it("refuses a missing target and a field it doesn't define", () => {
    assert.throws(() => GitRebasePlanParams.fromJson({ folder: "/r" }), { name: "JsonException", path: "$.onto" });
    assert.throws(() => GitRebasePlanParams.fromJson({ folder: "/r", onto, more: 1 }), expected("$.more", "none, since the model doesn't define it"));
  });
});
