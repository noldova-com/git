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
import { DiffHunk } from "../../src/models/diff-hunk.ts";
import { DiffLine } from "../../src/models/diff-line.ts";

describe("DiffHunk", () => {
  it("keeps its ranges, header and lines, and reads back the same", () => {
    const hunk = new DiffHunk(0, 0, 1, 1, "", [new DiffLine(LineKind.Added, null, 1, "a")]);

    assert.deepEqual(hunk.toJson(), {
      oldStart: 0,
      oldCount: 0,
      newStart: 1,
      newCount: 1,
      header: "",
      lines: [{ kind: "Added", oldNumber: null, newNumber: 1, text: "a" }]
    });
    assert.deepEqual(DiffHunk.fromJson(JSON.parse(JSON.stringify(hunk.toJson()))), hunk);
  });

  it("refuses a negative range and an invalid line, naming its path", () => {
    assert.throws(() => new DiffHunk(-1, 0, 1, 1, "", []), { name: "ProtocolFieldException", field: "oldStart" });
    assert.throws(() => new DiffHunk(1, -1, 1, 1, "", []), { name: "ProtocolFieldException", field: "oldCount" });
    assert.throws(() => new DiffHunk(1, 1, -1, 1, "", []), { name: "ProtocolFieldException", field: "newStart" });
    assert.throws(() => new DiffHunk(1, 1, 1, 0.5, "", []), { name: "ProtocolFieldException", field: "newCount" });
    assert.throws(() => DiffHunk.fromJson({ oldStart: 1, oldCount: 1, newStart: 1, newCount: 1, header: "f()", lines: [{}] }, "$.files[0].hunks[2]"),
      { name: "JsonException", path: "$.files[0].hunks[2].lines.0.kind" });
    assert.throws(() => DiffHunk.fromJson({ oldStart: 1, oldCount: 1, newStart: 1, newCount: 1, header: "", lines: [], text: "" }), { name: "ProtocolFieldException", field: "$.text" });
  });
});
