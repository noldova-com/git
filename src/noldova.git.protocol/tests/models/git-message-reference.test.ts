/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";

import { describe, it } from "vitest";

import { GitMessageReference } from "../../src/models/git-message-reference.ts";

const expected = (field: string, expectation: string): { name: string; field: string; message: string } =>
  ({ name: "ProtocolFieldException", field, message: `The field ${field} is invalid: expected ${expectation}.` });

describe("GitMessageReference", () => {
  const id = "0123456789abcdef0123456789abcdef01234567";

  it("keeps its commit id and a copy of its numbers in order, and reads back the same", () => {
    const numbers: number[] = [7531, 1, 9_999_999_999];
    const reference = new GitMessageReference(id, numbers);
    numbers.push(2);

    assert.deepEqual(reference.toJson(), { id, numbers: [7531, 1, 9_999_999_999] });
    assert.deepEqual(GitMessageReference.fromJson(JSON.parse(JSON.stringify(reference.toJson()))), reference);
  });

  it("refuses a short id, no numbers, and a number out of range or not whole, naming its path", () => {
    const number = "a whole number from 1 to 9999999999";

    assert.throws(() => GitMessageReference.fromJson({ id: "abc", numbers: [1] }), expected("$.id", "a full hexadecimal object id"));
    assert.throws(() => GitMessageReference.fromJson({ id, numbers: [] }), expected("$.numbers", "at least one number"));
    assert.throws(() => GitMessageReference.fromJson({ id, numbers: [1, 0] }), expected("$.numbers.1", number));
    assert.throws(() => new GitMessageReference(id, [10_000_000_000]), expected("numbers.0", number));
    assert.throws(() => new GitMessageReference(id, [2, 1.5]), expected("numbers.1", number));
  });

  it("refuses numbers that aren't numbers and a field it doesn't define", () => {
    assert.throws(() => GitMessageReference.fromJson({ id, numbers: ["1"] }), { name: "JsonException" });
    assert.throws(() => GitMessageReference.fromJson({ id }), { name: "JsonException", path: "$.numbers" });
    assert.throws(() => GitMessageReference.fromJson({ id, numbers: [1], subject: "" }), expected("$.subject", "none, since the model doesn't define it"));
  });
});
