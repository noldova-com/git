/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";

import { describe, it } from "vitest";

import { StatusUpstream } from "../../src/models/status-upstream.ts";

describe("StatusUpstream", () => {
  it("keeps its fields and returns them as JSON that reads back the same", () => {
    const upstream = new StatusUpstream("origin/main", 2, 1, false);

    assert.deepEqual(upstream.toJson(), { name: "origin/main", ahead: 2, behind: 1, gone: false });
    assert.deepEqual(StatusUpstream.fromJson(JSON.parse(JSON.stringify(upstream.toJson()))), upstream);
  });

  it("a gone upstream counts nothing ahead or behind", () => {
    assert.equal(new StatusUpstream("origin/old", 0, 0, true).gone, true);
    assert.throws(() => new StatusUpstream("origin/old", 1, 0, true), { name: "ProtocolFieldException", field: "ahead", message: "The field ahead is invalid: expected 0, since the upstream is gone." });
    assert.throws(() => StatusUpstream.fromJson({ name: "origin/old", ahead: 0, behind: 3, gone: true }), { name: "ProtocolFieldException", field: "$.behind" });
  });

  it("refuses an empty name, a negative count and a field it doesn't define", () => {
    assert.throws(() => new StatusUpstream("", 0, 0, false), { name: "ProtocolFieldException", field: "name" });
    assert.throws(() => StatusUpstream.fromJson({ name: "origin/main", ahead: -1, behind: 0, gone: false }), { name: "ProtocolFieldException", field: "$.ahead" });
    assert.throws(() => StatusUpstream.fromJson({ name: "origin/main", ahead: 0, behind: 0, gone: false, remote: "origin" }), { name: "ProtocolFieldException", field: "$.remote" });
  });
});
