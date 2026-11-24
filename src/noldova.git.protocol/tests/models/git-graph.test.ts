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
import { GitGraph } from "../../src/models/git-graph.ts";
import { GitGraphCommit } from "../../src/models/git-graph-commit.ts";
import { GitGraphParams } from "../../src/models/git-graph-params.ts";
import { GitRef } from "../../src/models/git-ref.ts";

describe("GitGraph", () => {
  const id = "0123456789abcdef0123456789abcdef01234567";
  const commit = new GitCommit(id, [], "A Person", "2026-11-20T14:02:00Z", "Start");
  const graphCommit = new GitGraphCommit(commit, "a@example.com", [new GitRef(RefKind.Head, ""), new GitRef(RefKind.Branch, "main"), new GitRef(RefKind.Tag, "v1")]);

  it("keeps its commits, each with its author's email and labels, and whether more follow, and reads back the same", () => {
    const graph = new GitGraph([graphCommit], true);

    assert.deepEqual(graph.toJson(), {
      commits: [{ commit: commit.toJson(), email: "a@example.com", refs: [{ kind: "Head", name: "" }, { kind: "Branch", name: "main" }, { kind: "Tag", name: "v1" }] }],
      truncated: true
    });
    assert.deepEqual(GitGraph.fromJson(JSON.parse(JSON.stringify(graph.toJson()))), graph);
  });

  it("refuses more commits than a page holds, an email of more than one line, an unknown label kind, a named label without a name, and unknown fields", () => {
    const json = graphCommit.toJson();

    assert.throws(() => new GitGraph(Array.from({ length: 5_001 }, () => graphCommit), false), { name: "ProtocolFieldException", field: "commits" });
    assert.throws(() => GitGraphCommit.fromJson({ ...json, email: "a\nb" }), { name: "ProtocolFieldException", field: "$.email" });
    assert.throws(() => new GitRef("Stash" as RefKind, "s"), { name: "ProtocolFieldException", field: "kind" });
    assert.throws(() => GitRef.fromJson({ kind: "Branch", name: "" }), { name: "ProtocolFieldException", field: "$.name" });
    assert.throws(() => GitRef.fromJson({ kind: "Tag", name: "a\nb" }), { name: "ProtocolFieldException", field: "$.name" });
    assert.throws(() => GitRef.fromJson({ kind: "Tag", name: "v1", more: 1 }), { name: "ProtocolFieldException" });
    assert.throws(() => GitGraphCommit.fromJson({ ...json, more: 1 }), { name: "ProtocolFieldException" });
    assert.throws(() => GitGraph.fromJson({ commits: [], truncated: false, more: 1 }), { name: "ProtocolFieldException" });
  });
});

describe("GitGraphParams", () => {
  it("keeps its folder, page size and offset, reads back the same, and refuses a relative folder, a page out of range, a negative offset and an unknown field", () => {
    const params = new GitGraphParams("/home/a/repo", 100, 200);

    assert.deepEqual(params.toJson(), { folder: "/home/a/repo", limit: 100, skip: 200 });
    assert.deepEqual(GitGraphParams.fromJson(params.toJson()), params);
    assert.throws(() => GitGraphParams.fromJson({ folder: "repo", limit: 1, skip: 0 }), { name: "ProtocolFieldException", field: "$.folder" });
    assert.throws(() => GitGraphParams.fromJson({ folder: "/r", limit: 0, skip: 0 }), { name: "ProtocolFieldException", field: "$.limit" });
    assert.throws(() => GitGraphParams.fromJson({ folder: "/r", limit: 5_001, skip: 0 }), { name: "ProtocolFieldException", field: "$.limit" });
    assert.throws(() => new GitGraphParams("/r", 1.5, 0), { name: "ProtocolFieldException", field: "limit" });
    assert.throws(() => GitGraphParams.fromJson({ folder: "/r", limit: 1, skip: -1 }), { name: "ProtocolFieldException", field: "$.skip" });
    assert.throws(() => new GitGraphParams("/r", 1, 0.5), { name: "ProtocolFieldException", field: "skip" });
    assert.throws(() => GitGraphParams.fromJson({ folder: "/r", limit: 1, skip: 0, more: 1 }), { name: "ProtocolFieldException" });
  });
});
