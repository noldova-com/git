/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";

import { describe, it } from "vitest";

import { LineKind } from "../../src/enums/line-kind.ts";
import { DiffLine } from "../../src/models/diff-line.ts";

describe("DiffLine", () => {
  it("each kind numbers the sides it has, and reads back the same", () => {
    const lines = [
      new DiffLine(LineKind.Context, 3, 4, "same"),
      new DiffLine(LineKind.Added, null, 5, "new\r"),
      new DiffLine(LineKind.Removed, 4, null, "old"),
      new DiffLine(LineKind.NoNewlineAtEnd, null, null, "\\ No newline at end of file")
    ];

    assert.deepEqual(lines[1]?.toJson(), { kind: "Added", oldNumber: null, newNumber: 5, text: "new\r" });
    for (const line of lines)
      assert.deepEqual(DiffLine.fromJson(JSON.parse(JSON.stringify(line.toJson()))), line);
  });

  it("refuses a missing number on a side the kind has, and a number on a side it doesn't", () => {
    assert.throws(() => new DiffLine(LineKind.Context, null, 4, "same"), { name: "ProtocolFieldException", field: "oldNumber", message: "The field oldNumber is invalid: expected a whole number above zero." });
    assert.throws(() => new DiffLine(LineKind.Added, 1, 5, "new"), { name: "ProtocolFieldException", field: "oldNumber", message: "The field oldNumber is invalid: expected null." });
    assert.throws(() => new DiffLine(LineKind.Removed, 4, 0, "old"), { name: "ProtocolFieldException", field: "newNumber" });
    assert.throws(() => DiffLine.fromJson({ kind: "Added", oldNumber: null, newNumber: 0, text: "new" }, "$.lines[1]"), { name: "ProtocolFieldException", field: "$.lines[1].newNumber" });
  });

  it("refuses an unknown kind, text that isn't text and a field it doesn't define", () => {
    assert.throws(() => DiffLine.fromJson({ kind: "Changed", oldNumber: null, newNumber: null, text: "" }), { name: "JsonException", path: "$.kind" });
    assert.throws(() => DiffLine.fromJson({ kind: "Added", oldNumber: null, newNumber: 1, text: 1 }), { name: "JsonException", path: "$.text" });
    assert.throws(() => DiffLine.fromJson({ kind: "Added", oldNumber: null, newNumber: 1, text: "", bytes: "" }), { name: "ProtocolFieldException", field: "$.bytes" });
  });
});
