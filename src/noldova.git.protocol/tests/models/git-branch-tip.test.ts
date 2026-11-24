/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";

import { describe, it } from "vitest";

import { GitBranchTip } from "../../src/models/git-branch-tip.ts";

const ID: string = "0123456789abcdef0123456789abcdef01234567";
const AT: string = "2026-11-23T10:00:00+01:00";

describe("GitBranchTip", () => {
  it("keeps the branch, the commit it points at and when it was committed, and reads back the same", () => {
    const tip = new GitBranchTip("feature/view", ID, AT);

    assert.deepEqual(tip.toJson(), { branch: "feature/view", id: ID, committedAt: AT });
    assert.deepEqual(GitBranchTip.fromJson(JSON.parse(JSON.stringify(tip.toJson()))), tip);
  });

  it("refuses an empty branch, an id that isn't a full commit id, a time without its offset and an unknown field, naming its path", () => {
    assert.throws(() => new GitBranchTip("", ID, AT), { name: "ProtocolFieldException", field: "branch" });
    assert.throws(() => new GitBranchTip("main", "0123456", AT), { name: "ProtocolFieldException", field: "id" });
    assert.throws(() => new GitBranchTip("main", ID, "2026-11-23T10:00:00"), { name: "ProtocolFieldException", field: "committedAt" });
    assert.throws(() => new GitBranchTip("main", ID, "2026-13-45T10:00:00Z"), { name: "ProtocolFieldException", field: "committedAt" });
    assert.throws(() => GitBranchTip.fromJson({ branch: "main", id: ID.toUpperCase(), committedAt: AT }), { name: "ProtocolFieldException", field: "$.id" });
    assert.throws(() => GitBranchTip.fromJson({ branch: "main", committedAt: AT }), { name: "JsonException", path: "$.id" });
    assert.throws(() => GitBranchTip.fromJson({ branch: "main", id: ID }), { name: "JsonException", path: "$.committedAt" });
    assert.throws(() => GitBranchTip.fromJson({ branch: "main", id: ID, committedAt: AT, ahead: 0 }), { name: "ProtocolFieldException", field: "$.ahead" });
  });
});
