/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";

import { describe, it } from "vitest";

import { SubmoduleChange } from "../../src/models/submodule-change.ts";

describe("SubmoduleChange", () => {
  const before = "1".repeat(40);
  const after = "2".repeat(40);

  it("keeps its old and new commits, either of which may be missing, and reads back the same", () => {
    for (const change of [new SubmoduleChange(before, after), new SubmoduleChange(null, after), new SubmoduleChange(before, null)])
      assert.deepEqual(SubmoduleChange.fromJson(JSON.parse(JSON.stringify(change.toJson()))), change);
    assert.deepEqual(new SubmoduleChange(null, after).toJson(), { oldCommit: null, newCommit: after });
  });

  it("refuses no commit at all, an abbreviated commit and a field it doesn't define", () => {
    assert.throws(() => new SubmoduleChange(null, null), { name: "ProtocolFieldException", field: "oldCommit", message: "The field oldCommit is invalid: expected an old or a new commit." });
    assert.throws(() => new SubmoduleChange("1234567", after), { name: "ProtocolFieldException", field: "oldCommit" });
    assert.throws(() => new SubmoduleChange(before, "1234567"), { name: "ProtocolFieldException", field: "newCommit" });
    assert.throws(() => SubmoduleChange.fromJson({ oldCommit: null, newCommit: after, path: "lib" }), { name: "ProtocolFieldException", field: "$.path" });
  });
});
