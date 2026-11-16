/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";

import { describe, it } from "vitest";

import { WorktreeRecord } from "../../src/models/worktree-record.ts";

describe("WorktreeRecord", () => {
  const SHA1 = "0123456789abcdef0123456789abcdef01234567";
  const SHA256 = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";
  const json = { key: "k1", repository: "/r", path: "/w/1f2e", branch: "noldova/1f2e", base: SHA1 };
  const refusal = (field: string, expectation: string): { name: string; field: string; expectation: string; message: string } =>
    ({ name: "ProtocolFieldException", field, expectation, message: `The field ${field} is invalid: expected ${expectation}.` });

  it("round-trips its JSON form", () => {
    const record = WorktreeRecord.fromJson(JSON.parse(JSON.stringify(json)));

    assert.equal(record.key, "k1");
    assert.equal(record.repository, "/r");
    assert.equal(record.path, "/w/1f2e");
    assert.equal(record.branch, "noldova/1f2e");
    assert.equal(record.base, SHA1);
    assert.deepEqual(record.toJson(), json);
  });

  it("accepts a SHA-256 object id", () => {
    assert.equal(new WorktreeRecord("k", "/r", "/w", "b", SHA256).base, SHA256);
  });

  for (const base of ["HEAD", SHA1.slice(0, 12), SHA1.toUpperCase(), `${SHA1}0`])
    it(`refuses the base ${base}`, () => {
      assert.throws(() => new WorktreeRecord("k", "/r", "/w", "b", base), refusal("base", "a full hexadecimal object id"));
      assert.throws(() => WorktreeRecord.fromJson({ ...json, base }), refusal("$.base", "a full hexadecimal object id"));
    });

  for (const field of ["key", "repository", "path", "branch"] as const) {
    it(`refuses an empty ${field}, by name and by path`, () => {
      const values = { ...json, [field]: "" };

      assert.throws(() => new WorktreeRecord(values.key, values.repository, values.path, values.branch, values.base),
        refusal(field, "a text that isn't empty"));
      assert.throws(() => WorktreeRecord.fromJson(values), refusal(`$.${field}`, "a text that isn't empty"));
    });

    it(`refuses a missing ${field}`, () => {
      const values = Object.fromEntries(Object.entries(json).filter(([name]) => name !== field));

      assert.throws(() => WorktreeRecord.fromJson(values), { name: "JsonException", path: `$.${field}` });
    });
  }

  it("refuses an unknown field and a value that isn't an object, at the path it is given", () => {
    assert.throws(() => WorktreeRecord.fromJson({ ...json, state: "Ready" }), refusal("$.state", "none, since the model doesn't define it"));
    assert.throws(() => WorktreeRecord.fromJson(null, "$.worktrees[0]"), { name: "JsonException", path: "$.worktrees[0]" });
  });
});
