/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */


import assert from "node:assert/strict";

import { JsonReader } from "@noldova/context.json";
import { describe, it } from "vitest";

import { CheckState } from "../../src/enums/check-state.ts";
import { FieldCheck } from "../../src/models/field-check.ts";

interface IArgumentFailure {
  readonly name: string;
  readonly parameterName: string;
  readonly message: string;
}

interface IFieldFailure {
  readonly name: string;
  readonly field: string;
  readonly message: string;
}

describe("FieldCheck", () => {
  const reader = JsonReader.fromValue({ kept: "a", missing: null, state: "Queued", child: { a: 1 } }, "$.item");
  const argument = (parameterName: string, expectation: string): IArgumentFailure =>
    ({ name: "HostingArgumentException", parameterName, message: `The argument ${parameterName} is invalid: expected ${expectation}.` });
  const field = (path: string, expectation: string): IFieldFailure =>
    ({ name: "HostingFieldException", field: path, message: `The field ${path} is invalid: expected ${expectation}.` });

  it("names a parameter without a reader, and a field by its path with one", () => {
    assert.throws(() => FieldCheck.fail("title", "a title"), argument("title", "a title"));
    assert.throws(() => FieldCheck.fail("title", "a title", reader), field("$.item.title", "a title"));
  });

  it("refuses the first field it doesn't know", () => {
    assert.doesNotThrow(() => FieldCheck.refuseUnknownFields(reader, ["kept", "missing", "state", "child"]));
    assert.throws(() => FieldCheck.refuseUnknownFields(reader, ["kept", "missing", "state"]), field("$.item.child", "none, since the model doesn't define it"));
  });

  it("reads a nullable model and a nullable member, null as null", () => {
    assert.deepEqual(FieldCheck.readNullableModel(reader, "child", (value, path) => [value, path]), [{ a: 1 }, "$.item.child"]);
    assert.equal(FieldCheck.readNullableModel(reader, "missing", () => "read"), null);
    assert.equal(FieldCheck.readNullableMember(reader, "state", [CheckState.Queued]), CheckState.Queued);
    assert.equal(FieldCheck.readNullableMember(reader, "missing", [CheckState.Queued]), null);
    assert.throws(() => FieldCheck.readNullableMember(reader, "state", [CheckState.Failed]), { name: "JsonException", path: "$.item.state" });
  });

  it("requires a member of a list, answering it, and names the members it takes", () => {
    assert.equal(FieldCheck.requireMember("Queued", [CheckState.Queued, CheckState.Failed], "state"), CheckState.Queued);
    assert.throws(() => FieldCheck.requireMember("Skipped", [CheckState.Queued, CheckState.Failed], "state"), argument("state", "one of Queued, Failed"));
    assert.throws(() => FieldCheck.requireMember("Skipped", [CheckState.Queued], "state", reader), field("$.item.state", "one of Queued"));
  });

  it("requires a text that isn't blank, a whole number above zero and a count of zero or more", () => {
    assert.doesNotThrow(() => FieldCheck.requireText("a", "title"));
    for (const value of ["", " ", "\t"])
      assert.throws(() => FieldCheck.requireText(value, "title"), argument("title", "a text that isn't blank"));
    assert.doesNotThrow(() => FieldCheck.requirePositive(1, "number"));
    for (const value of [0, -1, 1.5, 2 ** 53])
      assert.throws(() => FieldCheck.requirePositive(value, "number"), argument("number", "a whole number above zero"));
    assert.doesNotThrow(() => FieldCheck.requireCount(0, "comments"));
    for (const value of [-1, 0.5, 2 ** 53])
      assert.throws(() => FieldCheck.requireCount(value, "comments"), argument("comments", "a whole number, zero or more"));
  });

  it("requires a name and a path of a host's names, none of them '.' or '..'", () => {
    for (const value of ["hello-world", "a.b_c", "..."])
      assert.doesNotThrow(() => FieldCheck.requireName(value, "repository"));
    for (const value of ["", ".", "..", "a/b", "a b"])
      assert.throws(() => FieldCheck.requireName(value, "repository"), argument("repository", "a name of letters, digits, '.', '_' and '-', other than '.' and '..'"));
    for (const value of ["octocat", "group/sub/project", "fabrikam/Sample%20Project/_git/site", "a/%C3%A9t%c3%a9", "a/.%2ex"])
      assert.doesNotThrow(() => FieldCheck.requirePath(value, "owner"));
    for (const value of ["", "/a", "a/", "a//b", "a/../b", "./a", "a/.", "a b", "a/%2e", "%2E%2e/a", "a/.%2E", "a/%2", "a/%zz", "a/%", "a%2F..", "a%5c..", "a/b%2fc"])
      assert.throws(() => FieldCheck.requirePath(value, "owner"), argument("owner", "names of letters, digits, '.', '_', '-' and percent escapes such as '%20' but not of '/' or '\\' joined by '/', none of them '.' or '..', '%2e' counting as a dot"));
  });

  it("requires a full commit hash, a data image avatar and an https address without a user", () => {
    for (const value of ["a".repeat(40), "b".repeat(64)])
      assert.doesNotThrow(() => FieldCheck.requireCommit(value, "headCommit"));
    for (const value of ["a".repeat(39), "A".repeat(40), "a".repeat(41)])
      assert.throws(() => FieldCheck.requireCommit(value, "headCommit"), argument("headCommit", "a full commit hash, 40 or 64 lowercase hexadecimal digits"));
    assert.doesNotThrow(() => FieldCheck.requireAvatar(`data:image/png;base64,${"A".repeat(87_384)}`, "avatar"));
    for (const value of ["data:image/png;base64,", `data:image/png;base64,${"A".repeat(87_388)}`, "data:image/svg+xml;base64,PHN2Zy8+"])
      assert.throws(() => FieldCheck.requireAvatar(value, "avatar"),
        argument("avatar", "a PNG, JPEG, GIF or WebP image of at most 64 KiB as a base64 data address"));
    assert.doesNotThrow(() => FieldCheck.requireHttps("https://example.invalid/page", "url"));
    for (const value of ["http://example.invalid", "example.invalid", "https://user@example.invalid", "https://:secret@example.invalid"])
      assert.throws(() => FieldCheck.requireHttps(value, "url"), argument("url", "an https address with no user name or password"), value);
  });
});
