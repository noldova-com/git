/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";

import { describe, it } from "vitest";

import { DiffTotals } from "../../src/models/diff-totals.ts";

describe("DiffTotals", () => {
  it("keeps the files changed and the lines added and removed, and reads back the same", () => {
    const totals = new DiffTotals(2391, 14214, 0);

    assert.deepEqual(totals.toJson(), { files: 2391, added: 14214, removed: 0 });
    assert.deepEqual(DiffTotals.fromJson(JSON.parse(JSON.stringify(totals.toJson()))), totals);
  });

  it("refuses a count that isn't a whole number of zero or more, a missing count and an unknown field, naming its path", () => {
    assert.throws(() => new DiffTotals(-1, 0, 0), { name: "ProtocolFieldException", field: "files", message: "The field files is invalid: expected a whole number of zero or more." });
    assert.throws(() => new DiffTotals(0, 1.5, 0), { name: "ProtocolFieldException", field: "added" });
    assert.throws(() => DiffTotals.fromJson({ files: 0, added: 0, removed: -2 }, "$.totals"), { name: "ProtocolFieldException", field: "$.totals.removed" });
    assert.throws(() => DiffTotals.fromJson({ files: 0, added: 0 }), { name: "JsonException", path: "$.removed" });
    assert.throws(() => DiffTotals.fromJson({ files: 0, added: 0, removed: 0, changed: 0 }), { name: "ProtocolFieldException", field: "$.changed" });
  });
});
