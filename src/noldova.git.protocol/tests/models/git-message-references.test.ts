/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";
import { describe, it } from "vitest";

import { GitMessageReferenceKind } from "../../src/enums/git-message-reference-kind.ts";
import { GitMessageReference } from "../../src/models/git-message-reference.ts";
import { GitMessageReferences } from "../../src/models/git-message-references.ts";
import { GitMessageReferencesParams } from "../../src/models/git-message-references-params.ts";

const id: string = "0123456789abcdef0123456789abcdef01234567";

describe("GitMessageReferences", () => {
  it("keeps each commit's id and reference numbers, and whether older commits went unread, and reads back the same", () => {
    const numbers: number[] = [7531, 9_999_999_999];
    const references = new GitMessageReferences([new GitMessageReference(id, numbers)], true);
    numbers.push(1);

    assert.deepEqual(references.toJson(), { commits: [{ id, numbers: [7531, 9_999_999_999] }], truncated: true });
    assert.deepEqual(GitMessageReferences.fromJson(JSON.parse(JSON.stringify(references.toJson()))), references);
  });

  it("refuses a short id, no numbers, a number out of range or not whole, more commits than a page holds, and unknown fields", () => {
    const reference = new GitMessageReference(id, [1]);

    assert.throws(() => GitMessageReference.fromJson({ id: "abc", numbers: [1] }), { name: "ProtocolFieldException", field: "$.id" });
    assert.throws(() => GitMessageReference.fromJson({ id, numbers: [] }), { name: "ProtocolFieldException", field: "$.numbers" });
    assert.throws(() => GitMessageReference.fromJson({ id, numbers: [1, 0] }), { name: "ProtocolFieldException", field: "$.numbers.1" });
    assert.throws(() => new GitMessageReference(id, [10_000_000_000]), { name: "ProtocolFieldException", field: "numbers.0" });
    assert.throws(() => new GitMessageReference(id, [1.5]), { name: "ProtocolFieldException", field: "numbers.0" });
    assert.throws(() => GitMessageReference.fromJson({ id, numbers: [1], subject: "" }), { name: "ProtocolFieldException" });
    assert.throws(() => new GitMessageReferences(Array.from({ length: 5_001 }, () => reference), false), { name: "ProtocolFieldException", field: "commits" });
    assert.throws(() => GitMessageReferences.fromJson({ commits: [], truncated: false, more: 1 }), { name: "ProtocolFieldException" });
  });
});

describe("GitMessageReferencesParams", () => {
  it("keeps its folder, kind and limit, reads back the same, and refuses a relative folder, an unknown kind, a limit out of range and an unknown field", () => {
    const params = new GitMessageReferencesParams("/home/a/repo", GitMessageReferenceKind.AzureBoards, 1000);

    assert.deepEqual(params.toJson(), { folder: "/home/a/repo", kind: "AzureBoards", limit: 1000 });
    assert.deepEqual(GitMessageReferencesParams.fromJson(params.toJson()), params);
    assert.throws(() => GitMessageReferencesParams.fromJson({ folder: "repo", kind: "AzureBoards", limit: 1 }), { name: "ProtocolFieldException", field: "$.folder" });
    assert.throws(() => GitMessageReferencesParams.fromJson({ folder: "/r", kind: "GitHub", limit: 1 }), { name: "JsonException", path: "$.kind" });
    assert.throws(() => new GitMessageReferencesParams("/r", "GitHub" as GitMessageReferenceKind, 1), { name: "ProtocolFieldException", field: "kind" });
    assert.throws(() => GitMessageReferencesParams.fromJson({ folder: "/r", kind: "AzureBoards", limit: 0 }), { name: "ProtocolFieldException", field: "$.limit" });
    assert.throws(() => GitMessageReferencesParams.fromJson({ folder: "/r", kind: "AzureBoards", limit: 5_001 }), { name: "ProtocolFieldException", field: "$.limit" });
    assert.throws(() => new GitMessageReferencesParams("/r", GitMessageReferenceKind.AzureBoards, 1.5), { name: "ProtocolFieldException", field: "limit" });
    assert.throws(() => GitMessageReferencesParams.fromJson({ folder: "/r", kind: "AzureBoards", limit: 1, more: 1 }), { name: "ProtocolFieldException" });
  });
});
