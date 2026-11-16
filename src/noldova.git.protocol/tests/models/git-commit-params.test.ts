/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";

import { describe, it } from "vitest";

import { GitCommitParams } from "../../src/models/git-commit-params.ts";

describe("GitCommitParams", () => {
  it("keeps its folder, message and the fingerprint it is based on, and reads back the same", () => {
    const params = new GitCommitParams("C:/repo", "Add the status view\n\nIt lists the changed files.", "f1");

    assert.deepEqual(params.toJson(), { folder: "C:/repo", message: "Add the status view\n\nIt lists the changed files.", basedOn: "f1" });
    assert.deepEqual(GitCommitParams.fromJson(JSON.parse(JSON.stringify(params.toJson()))), params);
  });

  it("refuses a message with a NUL character, which git can't take as an argument, naming its path", () => {
    const refusal = { name: "ProtocolFieldException", field: "message", message: "The field message is invalid: expected a text without a NUL character." };

    assert.throws(() => new GitCommitParams("/repo", "Fix\u0000it", "f"), refusal);
    assert.throws(() => GitCommitParams.fromJson({ folder: "/repo", message: "\u0000", basedOn: "f" }, "$.params"), { ...refusal, field: "$.params.message", message: "The field $.params.message is invalid: expected a text without a NUL character." });
  });

  it("refuses a relative folder, an empty message or fingerprint, a missing field and an unknown field, naming its path", () => {
    assert.throws(() => new GitCommitParams("repo", "m", "f"), { name: "ProtocolFieldException", field: "folder" });
    assert.throws(() => new GitCommitParams("/repo", "", "f"), { name: "ProtocolFieldException", field: "message", message: "The field message is invalid: expected a text that isn't empty." });
    assert.throws(() => new GitCommitParams("/repo", "m", ""), { name: "ProtocolFieldException", field: "basedOn" });
    assert.throws(() => GitCommitParams.fromJson({ folder: "/repo", message: "", basedOn: "f" }, "$.params"), { name: "ProtocolFieldException", field: "$.params.message" });
    assert.throws(() => GitCommitParams.fromJson({ folder: "/repo", basedOn: "f" }), { name: "JsonException", path: "$.message" });
    assert.throws(() => GitCommitParams.fromJson({ folder: "/repo", message: "m", basedOn: "f", amend: true }), { name: "ProtocolFieldException", field: "$.amend" });
  });
});
