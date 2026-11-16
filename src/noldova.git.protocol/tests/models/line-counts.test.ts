/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";

import { describe, it } from "vitest";

import { LineCounts } from "../../src/models/line-counts.ts";

describe("LineCounts", () => {
  it("keeps the lines added and removed, and reads back the same", () => {
    const counts = new LineCounts(12, 0);

    assert.deepEqual(counts.toJson(), { added: 12, removed: 0 });
    assert.deepEqual(LineCounts.fromJson(JSON.parse(JSON.stringify(counts.toJson()))), counts);
  });

  it("refuses a count that isn't a whole number of zero or more, a missing count and an unknown field, naming its path", () => {
    assert.throws(() => new LineCounts(-1, 0), { name: "ProtocolFieldException", field: "added", message: "The field added is invalid: expected a whole number of zero or more." });
    assert.throws(() => new LineCounts(0, 1.5), { name: "ProtocolFieldException", field: "removed" });
    assert.throws(() => LineCounts.fromJson({ added: 0, removed: -2 }, "$.entries.0.indexCounts"), { name: "ProtocolFieldException", field: "$.entries.0.indexCounts.removed" });
    assert.throws(() => LineCounts.fromJson({ added: 0 }), { name: "JsonException", path: "$.removed" });
    assert.throws(() => LineCounts.fromJson({ added: "1", removed: 0 }), { name: "JsonException", path: "$.added" });
    assert.throws(() => LineCounts.fromJson({ added: 0, removed: 0, changed: 0 }), { name: "ProtocolFieldException", field: "$.changed" });
  });
});
