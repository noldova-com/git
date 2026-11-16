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

describe("DiffScope", () => {
  it("the worktree and staged scopes name no revisions, and a range names both", () => {
    const staged = new DiffScope(DiffScopeKind.Staged);
    const range = new DiffScope(DiffScopeKind.Range, "main", "HEAD");

    assert.deepEqual(staged.toJson(), { kind: "Staged" });
    assert.deepEqual(range.toJson(), { kind: "Range", from: "main", to: "HEAD" });
    assert.deepEqual(DiffScope.fromJson(JSON.parse(JSON.stringify(range.toJson()))), range);
    assert.deepEqual(DiffScope.fromJson(staged.toJson()), staged);
  });

  it("names a revision exactly when the scope is a range", () => {
    const expected = (field: string): { name: string; field: string; message: string } =>
      ({ name: "ProtocolFieldException", field, message: `The field ${field} is invalid: expected a revision exactly when the scope is a range.` });

    assert.throws(() => new DiffScope(DiffScopeKind.Worktree, "main"), expected("from"));
    assert.throws(() => new DiffScope(DiffScopeKind.Staged, undefined, "HEAD"), expected("to"));
    assert.throws(() => new DiffScope(DiffScopeKind.Range, "main"), expected("to"));
    assert.throws(() => new DiffScope(DiffScopeKind.Range, "", "HEAD"), expected("from"));
    assert.throws(() => DiffScope.fromJson({ kind: "Range", to: "HEAD" }), expected("$.from"));
    assert.throws(() => DiffScope.fromJson({ kind: "Staged", from: null }), { name: "JsonException", path: "$.from" });
  });

  it("refuses a revision with a NUL character, which git can't take as an argument, naming its path", () => {
    const expected = (field: string): { name: string; field: string; message: string } =>
      ({ name: "ProtocolFieldException", field, message: `The field ${field} is invalid: expected a text without a NUL character.` });

    assert.throws(() => new DiffScope(DiffScopeKind.Range, "ma\u0000in", "HEAD"), expected("from"));
    assert.throws(() => new DiffScope(DiffScopeKind.Range, "main", "HEAD\u0000"), expected("to"));
    assert.throws(() => DiffScope.fromJson({ kind: "Range", from: "main", to: "\u0000" }), expected("$.to"));
  });

  it("refuses an unknown kind and a field it doesn't define", () => {
    assert.throws(() => DiffScope.fromJson({ kind: "Index" }), { name: "JsonException", path: "$.kind" });
    assert.throws(() => DiffScope.fromJson({ kind: "Staged", paths: [] }), { name: "ProtocolFieldException", field: "$.paths" });
  });
});
