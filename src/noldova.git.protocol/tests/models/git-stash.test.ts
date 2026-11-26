/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";

import { describe, it } from "vitest";

import { GitStash } from "../../src/models/git-stash.ts";
import type { IFieldFailure } from "../fixtures/field-failure.fixture.ts";

const expected = (field: string, expectation: string): IFieldFailure =>
  ({ name: "ProtocolFieldException", field, message: `The field ${field} is invalid: expected ${expectation}.` });

describe("GitStash", () => {
  const id = "0123456789abcdef0123456789abcdef01234567";

  it("keeps its place, message and commit id, and reads back the same, with an empty message too", () => {
    const stash = new GitStash(2, "WIP on main: 0123456 Start", id);
    const bare = new GitStash(0, "", id);

    assert.deepEqual(stash.toJson(), { index: 2, message: "WIP on main: 0123456 Start", id });
    assert.deepEqual(GitStash.fromJson(JSON.parse(JSON.stringify(stash.toJson()))), stash);
    assert.deepEqual(GitStash.fromJson(JSON.parse(JSON.stringify(bare.toJson()))), bare);
  });

  it("refuses a negative or fractional place, a message that isn't one line and an id that isn't a full object id, naming its path", () => {
    const line = "a line of at most 1000 characters without a control character";

    assert.throws(() => GitStash.fromJson({ index: -1, message: "m", id }), expected("$.index", "a whole number of zero or more"));
    assert.throws(() => new GitStash(0.5, "m", id), expected("index", "a whole number of zero or more"));
    assert.throws(() => GitStash.fromJson({ index: 0, message: "a\nb", id }), expected("$.message", line));
    assert.throws(() => new GitStash(0, "x".repeat(1001), id), expected("message", line));
    assert.throws(() => GitStash.fromJson({ index: 0, message: "m", id: "stash@{0}" }), expected("$.id", "a full hexadecimal object id"));
  });

  it("refuses a missing id and a field it doesn't define", () => {
    assert.throws(() => GitStash.fromJson({ index: 0, message: "m" }), { name: "JsonException", path: "$.id" });
    assert.throws(() => GitStash.fromJson({ index: 0, message: "m", id, more: 1 }), expected("$.more", "none, since the model doesn't define it"));
  });
});
