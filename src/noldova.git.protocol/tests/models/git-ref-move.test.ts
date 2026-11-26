/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";
import { describe, it } from "vitest";

import { GitRefMove } from "../../src/models/git-ref-move.ts";

describe("GitRefMove", () => {
  const a = "0123456789abcdef0123456789abcdef01234567";
  const b = "89abcdef0123456789abcdef0123456789abcdef";

  it("keeps a branch's move, a tag's creation and HEAD's deletion, and reads each back the same", () => {
    for (const move of [new GitRefMove("refs/heads/team/a", a, b), new GitRefMove("refs/tags/v1", null, a), new GitRefMove("HEAD", b, null)])
      assert.deepEqual(GitRefMove.fromJson(move.toJson()), move);
    assert.deepEqual(new GitRefMove("refs/heads/main", a, b).toJson(), { name: "refs/heads/main", before: a, after: b });
  });

  it("refuses a short name, a remote's branch, a control character, a short id on either side, the same commit on both sides and an unknown field", () => {
    assert.throws(() => GitRefMove.fromJson({ name: "main", before: a, after: b }), { name: "ProtocolFieldException", field: "$.name" });
    assert.throws(() => GitRefMove.fromJson({ name: "refs/remotes/origin/main", before: a, after: b }), { name: "ProtocolFieldException", field: "$.name" });
    assert.throws(() => GitRefMove.fromJson({ name: "refs/heads/a\u0001", before: a, after: b }), { name: "ProtocolFieldException", field: "$.name" });
    assert.throws(() => GitRefMove.fromJson({ name: "refs/heads/a", before: "abc", after: b }), { name: "ProtocolFieldException", field: "$.before" });
    assert.throws(() => GitRefMove.fromJson({ name: "refs/heads/a", before: a, after: "abc" }), { name: "ProtocolFieldException", field: "$.after" });
    assert.throws(() => GitRefMove.fromJson({ name: "refs/heads/a", before: a, after: a }), { name: "ProtocolFieldException", field: "$.after" });
    assert.throws(() => GitRefMove.fromJson({ name: "refs/heads/a", before: null, after: null }), { name: "ProtocolFieldException", field: "$.after" });
    assert.throws(() => GitRefMove.fromJson({ name: "refs/heads/a", before: a, after: b, more: 1 }), { name: "ProtocolFieldException" });
  });
});
