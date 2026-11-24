/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";

import { describe, it } from "vitest";

import { GitRebaseCommit } from "../../src/models/git-rebase-commit.ts";

const expected = (field: string, expectation: string): { name: string; field: string; message: string } =>
  ({ name: "ProtocolFieldException", field, message: `The field ${field} is invalid: expected ${expectation}.` });

const a = "a".repeat(40);
const b = "b".repeat(40);

describe("GitRebaseCommit", () => {
  it("keeps its id, whole message and the commit it fixes up, and reads back the same, with or without one", () => {
    const fixup = new GitRebaseCommit(b, "fixup! Start\n\nMore", a);
    const plain = new GitRebaseCommit(a, "Start", null);

    assert.deepEqual(fixup.toJson(), { id: b, message: "fixup! Start\n\nMore", fixupOf: a });
    assert.deepEqual(plain.toJson(), { id: a, message: "Start", fixupOf: null });
    assert.deepEqual(GitRebaseCommit.fromJson(JSON.parse(JSON.stringify(fixup.toJson()))), fixup);
    assert.deepEqual(GitRebaseCommit.fromJson(JSON.parse(JSON.stringify(plain.toJson()))), plain);
  });

  it("gives the message's first line as its subject, or the whole message when it has one line", () => {
    assert.equal(new GitRebaseCommit(a, "fixup! Start\n\nMore", null).subject, "fixup! Start");
    assert.equal(new GitRebaseCommit(a, "Start", null).subject, "Start");
    assert.equal(new GitRebaseCommit(a, "\nBody", null).subject, "");
    assert.equal(new GitRebaseCommit(a, "", null).subject, "");
  });

  it("refuses an id or fixed-up commit that isn't a full id and a message with a NUL, naming its path", () => {
    assert.throws(() => GitRebaseCommit.fromJson({ id: "abc", message: "m", fixupOf: null }), expected("$.id", "a full hexadecimal object id"));
    assert.throws(() => GitRebaseCommit.fromJson({ id: a, message: "m\u0000", fixupOf: null }), expected("$.message", "a text without a NUL character"));
    assert.throws(() => GitRebaseCommit.fromJson({ id: a, message: "m", fixupOf: "main" }), expected("$.fixupOf", "a full hexadecimal object id"));
    assert.throws(() => new GitRebaseCommit(a, "m", ""), expected("fixupOf", "a full hexadecimal object id"));
  });

  it("refuses a missing fixed-up commit and a field it doesn't define", () => {
    assert.throws(() => GitRebaseCommit.fromJson({ id: a, message: "m" }), { name: "JsonException", path: "$.fixupOf" });
    assert.throws(() => GitRebaseCommit.fromJson({ id: a, message: "m", fixupOf: null, more: 1 }), expected("$.more", "none, since the model doesn't define it"));
  });
});
