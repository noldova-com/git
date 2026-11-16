/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";

import { describe, it } from "vitest";

import { OperationKind } from "../../src/enums/operation-kind.ts";
import { GitOperation } from "../../src/models/git-operation.ts";

describe("GitOperation", () => {
  it("keeps its kind, where it came from and its message, and reads back the same", () => {
    const operation = new GitOperation(OperationKind.Merge, "feature/view", "Merge branch 'feature/view'");

    assert.deepEqual(operation.toJson(), { kind: "Merge", from: "feature/view", message: "Merge branch 'feature/view'" });
    assert.deepEqual(GitOperation.fromJson(JSON.parse(JSON.stringify(operation.toJson()))), operation);
  });

  it("may name no source and no message", () => {
    const operation = new GitOperation(OperationKind.Revert, null, null);

    assert.deepEqual(operation.toJson(), { kind: "Revert", from: null, message: null });
    assert.deepEqual(GitOperation.fromJson(operation.toJson()), operation);
  });

  it("refuses an empty source or message, an unknown kind, a missing field and an unknown field, naming its path", () => {
    assert.throws(() => new GitOperation(OperationKind.CherryPick, "", null), { name: "ProtocolFieldException", field: "from", message: "The field from is invalid: expected a text that isn't empty." });
    assert.throws(() => new GitOperation(OperationKind.Rebase, null, ""), { name: "ProtocolFieldException", field: "message" });
    assert.throws(() => GitOperation.fromJson({ kind: "Merge", from: null, message: "" }, "$.operation"), { name: "ProtocolFieldException", field: "$.operation.message" });
    assert.throws(() => GitOperation.fromJson({ kind: "Bisect", from: null, message: null }), { name: "JsonException", path: "$.kind" });
    assert.throws(() => GitOperation.fromJson({ kind: "Merge", from: null }), { name: "JsonException", path: "$.message" });
    assert.throws(() => GitOperation.fromJson({ kind: "Merge", from: null, message: null, step: 1 }), { name: "ProtocolFieldException", field: "$.step" });
  });
});
