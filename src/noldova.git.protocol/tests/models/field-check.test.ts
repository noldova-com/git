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

import { FieldCheck } from "../../src/models/field-check.ts";

describe("FieldCheck", () => {
  const reader = JsonReader.fromValue({}, "$.files.0");
  const refusal = (field: string, expectation: string): { name: string; field: string; expectation: string; message: string } =>
    ({ name: "ProtocolFieldException", field, expectation, message: `The field ${field} is invalid: expected ${expectation}.` });

  it("names a field by its path with a reader, and by its name without one", () => {
    assert.throws(() => FieldCheck.fail("path", "a text", reader), refusal("$.files.0.path", "a text"));
    assert.throws(() => FieldCheck.fail("path", "a text"), refusal("path", "a text"));
  });

  it("requires a line of at most 1000 characters without a control character", () => {
    for (const value of ["", "a", "a".repeat(1000), "Fix the café's menu"])
      assert.doesNotThrow(() => FieldCheck.requireLine(value, "subject"));
    for (const value of ["a".repeat(1001), "a" + String.fromCharCode(10) + "b", "a" + String.fromCharCode(0x7f), String.fromCharCode(0x9b) + "2J"])
      assert.throws(() => FieldCheck.requireLine(value, "subject", reader), refusal("$.files.0.subject", "a line of at most 1000 characters without a control character"));
  });

  it("requires text that isn't empty", () => {
    assert.doesNotThrow(() => FieldCheck.requireText("a", "path"));
    assert.throws(() => FieldCheck.requireText("", "path"), refusal("path", "a text that isn't empty"));
  });

  it("requires a count of zero or more", () => {
    assert.doesNotThrow(() => FieldCheck.requireCount(0, "ahead"));
    for (const value of [-1, 0.5, Number.NaN, 2 ** 53])
      assert.throws(() => FieldCheck.requireCount(value, "ahead"), refusal("ahead", "a whole number of zero or more"));
  });

  it("requires a whole number above zero", () => {
    assert.doesNotThrow(() => FieldCheck.requirePositive(1, "oldNumber"));
    for (const value of [null, 0, 1.5, 2 ** 53])
      assert.throws(() => FieldCheck.requirePositive(value, "oldNumber"), refusal("oldNumber", "a whole number above zero"));
  });

  it("requires a full object id, in SHA-1 or SHA-256 length", () => {
    assert.doesNotThrow(() => FieldCheck.requireObjectId("a".repeat(40), "head"));
    assert.doesNotThrow(() => FieldCheck.requireObjectId("b".repeat(64), "head"));
    for (const value of ["a".repeat(39), "A".repeat(40), "g".repeat(40)])
      assert.throws(() => FieldCheck.requireObjectId(value, "head"), refusal("head", "a full hexadecimal object id"));
  });

  it("requires a path's bytes in base64, or none", () => {
    for (const value of [undefined, "/w==", "YWI=", "YWJj"])
      assert.doesNotThrow(() => FieldCheck.requirePathBytes(value, "pathBytes"));
    for (const value of ["", "YW=", "YWJ", "a b="])
      assert.throws(() => FieldCheck.requirePathBytes(value, "pathBytes"), refusal("pathBytes", "the path's bytes in base64"));
  });

  it("requires a file mode of six octal digits, or none", () => {
    for (const value of [null, "100644", "160000"])
      assert.doesNotThrow(() => FieldCheck.requireMode(value, "newMode"));
    for (const value of ["10644", "100648", "644"])
      assert.throws(() => FieldCheck.requireMode(value, "newMode"), refusal("newMode", "a file mode of six octal digits"));
  });

  it("requires null", () => {
    assert.doesNotThrow(() => FieldCheck.requireNull(null, "oldMode"));
    assert.throws(() => FieldCheck.requireNull("100644", "oldMode"), refusal("oldMode", "null"));
  });

  it("requires no value", () => {
    assert.doesNotThrow(() => FieldCheck.requireAbsent(undefined, "originalPathBytes"));
    assert.throws(() => FieldCheck.requireAbsent("YWI=", "originalPathBytes"), refusal("originalPathBytes", "no value"));
  });

  it("refuses a field the model doesn't define, naming it by its path", () => {
    const fields = JsonReader.fromValue({ path: "a", size: 1 }, "$.files.0");

    assert.doesNotThrow(() => FieldCheck.refuseUnknownFields(fields, ["path", "size"]));
    assert.throws(() => FieldCheck.refuseUnknownFields(fields, ["path"]), refusal("$.files.0.size", "none, since the model doesn't define it"));
  });

  it("reads a member that may be null", () => {
    const fields = JsonReader.fromValue({ kind: "Range", conflict: null });

    assert.deepEqual([FieldCheck.readNullableMember(fields, "kind", ["Worktree", "Range"]), FieldCheck.readNullableMember(fields, "conflict", ["Range"])], ["Range", null]);
    assert.throws(() => FieldCheck.readNullableMember(fields, "kind", ["Worktree"]), { name: "JsonException", path: "$.kind" });
    assert.throws(() => FieldCheck.readNullableMember(fields, "missing", ["Range"]), { name: "JsonException", path: "$.missing" });
  });

  it("reads a nested model that may be null, at its path", () => {
    const fields = JsonReader.fromValue({ upstream: { name: "origin/main" }, submodule: null }, "$.status");
    const read = (value: unknown, path: string): string => `${path}=${JSON.stringify(value)}`;

    assert.deepEqual([FieldCheck.readNullableModel(fields, "upstream", read), FieldCheck.readNullableModel(fields, "submodule", read)],
      ["$.status.upstream={\"name\":\"origin/main\"}", null]);
    assert.throws(() => FieldCheck.readNullableModel(JsonReader.fromValue({ upstream: 1 }), "upstream", read), { name: "JsonException", path: "$.upstream" });
  });

  it("reads a required nested model, at its path", () => {
    const read = (value: unknown, path: string): string => `${path}=${JSON.stringify(value)}`;

    assert.equal(FieldCheck.readModel(JsonReader.fromValue({ scope: { kind: "Staged" } }, "$.params"), "scope", read), "$.params.scope={\"kind\":\"Staged\"}");
    assert.throws(() => FieldCheck.readModel(JsonReader.fromValue({ scope: null }), "scope", read), { name: "JsonException", path: "$.scope" });
    assert.throws(() => FieldCheck.readModel(JsonReader.fromValue({ scope: [] }), "scope", read), { name: "JsonException", path: "$.scope" });
    assert.throws(() => FieldCheck.readModel(JsonReader.fromValue({}), "scope", read), { name: "JsonException", path: "$.scope" });
  });

  it("requires an absolute folder of at most 4096 characters", () => {
    for (const value of ["/", "/home/a/repo", "C:\\repo", "c:/repo", "\\\\server\\share\\repo", `/${"a".repeat(4095)}`])
      assert.doesNotThrow(() => FieldCheck.requireFolder(value, "folder"));
    for (const value of ["", " ", "repo", "./repo", "C:repo", "1:\\repo", "\\repo", `/${"a".repeat(4096)}`])
      assert.throws(() => FieldCheck.requireFolder(value, "folder"), refusal("folder", "an absolute path of at most 4096 characters"));
    assert.throws(() => FieldCheck.requireFolder("repo", "folder", reader), { name: "ProtocolFieldException", field: "$.files.0.folder" });
  });

  it("requires a relative path of 1 to 4096 characters, not starting with a drive and colon, a colon or a backslash, without a .. segment or a NUL character", () => {
    for (const value of ["a.txt", "src/a.ts", "src\\a.ts", "..a/b..", "a/.../b", ".gitignore", "ab:c", "1:a", "a".repeat(4096)])
      assert.doesNotThrow(() => FieldCheck.requireRelativePath(value, "paths.0"));
    for (const value of [
      "", "/a", "C:\\a", "c:/a", "\\\\server\\a", "C:foo", "a:b", "z:", ":/", ":(glob)**", ":!a", "\\a", "\\a\\b.txt", "..", "../a", "a/../b", "a\\..\\b", "a/..", "a\u0000b", "a".repeat(4097)
    ])
      assert.throws(() => FieldCheck.requireRelativePath(value, "paths.0"), refusal("paths.0",
        "a relative path of 1 to 4096 characters, not starting with a drive and colon, a colon or a backslash, without a .. segment or a NUL character"));
    assert.throws(() => FieldCheck.requireRelativePath("../a", "paths.1", reader), { name: "ProtocolFieldException", field: "$.files.0.paths.1" });
  });

  it("requires a text without a NUL character", () => {
    assert.doesNotThrow(() => FieldCheck.requireNoNul("main", "from"));
    assert.throws(() => FieldCheck.requireNoNul("a\u0000b", "from", reader), refusal("$.files.0.from", "a text without a NUL character"));
  });

  it("requires a branch name git accepts", () => {
    for (const value of ["main", "feature/view", "docs/6-git-view", "a.b", "a-", "x@y", "@a", "a.lock.b", "ü", "head", "HEADS", "a/HEAD", "b".repeat(255)])
      assert.doesNotThrow(() => FieldCheck.requireBranchName(value, "name"));
    for (const value of [
      "", "b".repeat(256), "-f", "--orphan=x", "@", "HEAD", "a..b", "a.", "x.lock", "a/x.lock/b", ".a", "a/.b", "/a", "a/", "a//b", "a b", "a\tb", "a\u007Fb",
      "a~1", "a^", "a:b", "a?", "a*", "a[b", "a\\b", "a@{1}"
    ])
      assert.throws(() => FieldCheck.requireBranchName(value, "name"), { name: "ProtocolFieldException", field: "name", message: /^The field name is invalid: expected a branch name git accepts: / });
    assert.throws(() => FieldCheck.requireBranchName("-f", "name", reader), { name: "ProtocolFieldException", field: "$.files.0.name" });
  });

  it("reads an array of nested models, each at its index's path", () => {
    const read = (value: unknown, path: string): string => `${path}=${JSON.stringify(value)}`;

    assert.deepEqual(FieldCheck.readModels(JsonReader.fromValue({ files: [{ a: 1 }, {}] }), "files", read), ["$.files.0={\"a\":1}", "$.files.1={}"]);
    assert.throws(() => FieldCheck.readModels(JsonReader.fromValue({ files: [1] }), "files", read), { name: "JsonException", path: "$.files.0" });
  });
});
