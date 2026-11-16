/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";

import { describe, it } from "vitest";

import { DiffScopeKind } from "../../src/enums/diff-scope-kind.ts";
import { DiffScope } from "../../src/models/diff-scope.ts";
import { GitDiffParams } from "../../src/models/git-diff-params.ts";

describe("GitDiffParams", () => {
  it("keeps its folder and scope, and reads back the same", () => {
    const params = new GitDiffParams("/repo", new DiffScope(DiffScopeKind.Range, "main", "HEAD"));

    assert.deepEqual(params.toJson(), { folder: "/repo", scope: { kind: "Range", from: "main", to: "HEAD" } });
    assert.deepEqual(GitDiffParams.fromJson(JSON.parse(JSON.stringify(params.toJson()))), params);
  });

  it("refuses a relative folder, a missing, null or invalid scope and an unknown field, naming its path", () => {
    const scope = { kind: "Staged" };

    assert.throws(() => new GitDiffParams("repo", new DiffScope(DiffScopeKind.Worktree)), { name: "ProtocolFieldException", field: "folder" });
    assert.throws(() => GitDiffParams.fromJson({ folder: "repo", scope }, "$.params"), { name: "ProtocolFieldException", field: "$.params.folder" });
    assert.throws(() => GitDiffParams.fromJson({ folder: "/repo" }), { name: "JsonException", path: "$.scope" });
    assert.throws(() => GitDiffParams.fromJson({ folder: "/repo", scope: null }), { name: "JsonException", path: "$.scope" });
    assert.throws(() => GitDiffParams.fromJson({ folder: "/repo", scope: { ...scope, kind: "Index" } }), { name: "JsonException", path: "$.scope.kind" });
    assert.throws(() => GitDiffParams.fromJson({ folder: "/repo", scope: { ...scope, from: "main" } }), { name: "ProtocolFieldException", field: "$.scope.from" });
    assert.throws(() => GitDiffParams.fromJson({ folder: "/repo", scope, paths: [] }), { name: "ProtocolFieldException", field: "$.paths" });
  });
});
