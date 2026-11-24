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
    const id = "0123456789abcdef0123456789abcdef01234567";
    const upstream = new StatusUpstream("origin/main", 2, 1, false, id);

    assert.deepEqual(upstream.toJson(), { name: "origin/main", ahead: 2, behind: 1, gone: false, id });
    assert.deepEqual(StatusUpstream.fromJson(JSON.parse(JSON.stringify(upstream.toJson()))), upstream);
    assert.equal(new StatusUpstream("origin/main", 0, 0, false).id, null);
  });

  it("a gone upstream counts nothing ahead or behind", () => {
    assert.equal(new StatusUpstream("origin/old", 0, 0, true).gone, true);
    assert.throws(() => new StatusUpstream("origin/old", 1, 0, true), { name: "ProtocolFieldException", field: "ahead", message: "The field ahead is invalid: expected 0, since the upstream is gone." });
    assert.throws(() => StatusUpstream.fromJson({ name: "origin/old", ahead: 0, behind: 3, gone: true, id: null }), { name: "ProtocolFieldException", field: "$.behind" });
    assert.throws(() => StatusUpstream.fromJson({ name: "origin/old", ahead: 0, behind: 0, gone: true, id: "0123456789abcdef0123456789abcdef01234567" }),
      { name: "ProtocolFieldException", field: "$.id", message: "The field $.id is invalid: expected null, since the upstream is gone." });
  });

  it("refuses an empty name, a negative count, an id that isn't a full id and a field it doesn't define", () => {
    assert.throws(() => new StatusUpstream("", 0, 0, false), { name: "ProtocolFieldException", field: "name" });
    assert.throws(() => StatusUpstream.fromJson({ name: "origin/main", ahead: -1, behind: 0, gone: false, id: null }), { name: "ProtocolFieldException", field: "$.ahead" });
    assert.throws(() => StatusUpstream.fromJson({ name: "origin/main", ahead: 0, behind: 0, gone: false, id: "main" }), { name: "ProtocolFieldException", field: "$.id" });
    assert.throws(() => StatusUpstream.fromJson({ name: "origin/main", ahead: 0, behind: 0, gone: false, id: null, remote: "origin" }), { name: "ProtocolFieldException", field: "$.remote" });
  });
});
