/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";

import { describe, it } from "vitest";

import { RefKind } from "../../src/enums/ref-kind.ts";
import { GitCommit } from "../../src/models/git-commit.ts";
import { GitGraphCommit } from "../../src/models/git-graph-commit.ts";
import { GitRef } from "../../src/models/git-ref.ts";

const expected = (field: string, expectation: string): { name: string; field: string; message: string } =>
  ({ name: "ProtocolFieldException", field, message: `The field ${field} is invalid: expected ${expectation}.` });

describe("GitGraphCommit", () => {
  const id = "0123456789abcdef0123456789abcdef01234567";
  const commit = new GitCommit(id, [], "A Person", "2026-11-20T14:02:00Z", "Start");
  const graphCommit = new GitGraphCommit(commit, "a@example.com", [new GitRef(RefKind.Head, ""), new GitRef(RefKind.Branch, "main")]);

  it("keeps its commit, its author's email and its labels, and reads back the same, with no labels or email too", () => {
    const bare = new GitGraphCommit(commit, "", []);

    assert.deepEqual(graphCommit.toJson(), {
      commit: { id, parents: [], author: "A Person", authoredAt: "2026-11-20T14:02:00Z", subject: "Start" },
      email: "a@example.com",
      refs: [{ kind: "Head", name: "" }, { kind: "Branch", name: "main" }]
    });
    assert.deepEqual(GitGraphCommit.fromJson(JSON.parse(JSON.stringify(graphCommit.toJson()))), graphCommit);
    assert.deepEqual(GitGraphCommit.fromJson(JSON.parse(JSON.stringify(bare.toJson()))), bare);
  });

  it("refuses an email of more than one line, naming its path", () => {
    const line = "a line of at most 1000 characters without a control character";

    assert.throws(() => GitGraphCommit.fromJson({ ...graphCommit.toJson(), email: "a\nb" }), expected("$.email", line));
    assert.throws(() => new GitGraphCommit(commit, "x".repeat(1001), []), expected("email", line));
  });

  it("refuses a broken commit or label, naming its path inside the commit", () => {
    const json = graphCommit.toJson();

    assert.throws(() => GitGraphCommit.fromJson({ ...json, commit: { ...commit.toJson(), id: "abc" } }), expected("$.commit.id", "a full hexadecimal object id"));
    assert.throws(() => GitGraphCommit.fromJson({ ...json, refs: [{ kind: "Tag", name: "" }] }), expected("$.refs.0.name", "a name for a branch or tag"));
    assert.throws(() => GitGraphCommit.fromJson({ ...json, refs: [{ kind: "Stash", name: "s" }] }), { name: "JsonException", path: "$.refs.0.kind" });
  });

  it("refuses a missing commit and a field it doesn't define", () => {
    assert.throws(() => GitGraphCommit.fromJson({ email: "", refs: [] }), { name: "JsonException", path: "$.commit" });
    assert.throws(() => GitGraphCommit.fromJson({ ...graphCommit.toJson(), more: 1 }), expected("$.more", "none, since the model doesn't define it"));
  });
});
