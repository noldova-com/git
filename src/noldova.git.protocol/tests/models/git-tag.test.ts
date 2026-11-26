/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";

import { describe, it } from "vitest";

import { GitTag } from "../../src/models/git-tag.ts";
import type { IFieldFailure } from "../fixtures/field-failure.fixture.ts";

const expected = (field: string, expectation: string): IFieldFailure =>
  ({ name: "ProtocolFieldException", field, message: `The field ${field} is invalid: expected ${expectation}.` });

describe("GitTag", () => {
  const id = "0123456789abcdef0123456789abcdef01234567";

  it("keeps its short name and commit id, and reads back the same", () => {
    const tag = new GitTag("v1.2.0", id);

    assert.deepEqual(tag.toJson(), { name: "v1.2.0", id });
    assert.deepEqual(GitTag.fromJson(JSON.parse(JSON.stringify(tag.toJson()))), tag);
  });

  it("refuses an empty name, a name that isn't one line and an id that isn't a full object id, naming its path", () => {
    const line = "a line of at most 1000 characters without a control character";

    assert.throws(() => GitTag.fromJson({ name: "", id }), expected("$.name", "a text that isn't empty"));
    assert.throws(() => GitTag.fromJson({ name: "v1\n", id }), expected("$.name", line));
    assert.throws(() => new GitTag("x".repeat(1001), id), expected("name", line));
    assert.throws(() => new GitTag("v1", "v1"), expected("id", "a full hexadecimal object id"));
  });

  it("refuses a missing id and a field it doesn't define", () => {
    assert.throws(() => GitTag.fromJson({ name: "v1" }), { name: "JsonException", path: "$.id" });
    assert.throws(() => GitTag.fromJson({ name: "v1", id, more: 1 }), expected("$.more", "none, since the model doesn't define it"));
  });
});
