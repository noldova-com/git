/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";
import { describe, it } from "vitest";

import { GitMarkerCheck } from "../../src/models/git-marker-check.ts";

describe("GitMarkerCheck", () => {
  it("keeps its paths, reads back the same, and refuses a path outside the repository, too many paths and an unknown field", () => {
    const check = new GitMarkerCheck(["src/history.reader.ts", "CHANGELOG.md"]);
    const many = Array.from({ length: 10001 }, (_, i) => `f${i}.ts`);

    assert.deepEqual(check.toJson(), { paths: ["src/history.reader.ts", "CHANGELOG.md"] });
    assert.deepEqual([GitMarkerCheck.fromJson(check.toJson()), GitMarkerCheck.fromJson({ paths: [] }).paths], [check, []]);
    assert.throws(() => GitMarkerCheck.fromJson({ paths: ["../outside.ts"] }), { name: "ProtocolFieldException", field: "$.paths.0" });
    assert.throws(() => GitMarkerCheck.fromJson({ paths: ["a.ts", "/etc/hosts"] }), { name: "ProtocolFieldException", field: "$.paths.1" });
    assert.throws(() => new GitMarkerCheck(many), { name: "ProtocolFieldException", field: "paths" });
    assert.throws(() => GitMarkerCheck.fromJson({ paths: [], more: 1 }), { name: "ProtocolFieldException" });
    assert.throws(() => GitMarkerCheck.fromJson({ paths: "a.ts" }), { name: "JsonException", path: "$.paths" });
  });
});
