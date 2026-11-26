/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";

import { describe, it } from "vitest";

import { GitLinesParams } from "../../src/models/git-lines-params.ts";

describe("GitLinesParams", () => {
  it("keeps its parts, and reads back the same", () => {
    const params = new GitLinesParams("/home/a/repo", "src/a.ts", [0, 4, 5], "f1");

    assert.deepEqual(params.toJson(), { folder: "/home/a/repo", path: "src/a.ts", lines: [0, 4, 5], basedOn: "f1" });
    assert.deepEqual(GitLinesParams.fromJson(JSON.parse(JSON.stringify(params.toJson()))), params);
  });

  it("refuses no lines, a line twice, a line that isn't a count, a missing part and an unknown field, naming its path", () => {
    const json = new GitLinesParams("/home/a/repo", "src/a.ts", [1], "f1").toJson();
    assert.throws(() => GitLinesParams.fromJson({ ...json, folder: "repo" }, "$.params"), { name: "ProtocolFieldException", field: "$.params.folder" });
    assert.throws(() => GitLinesParams.fromJson({ ...json, path: "../a.ts" }, "$.params"), { name: "ProtocolFieldException", field: "$.params.path" });
    for (const lines of [[], [2, 2], Array.from({ length: 100_001 }, (_, index) => index)])
      assert.throws(() => GitLinesParams.fromJson({ ...json, lines }, "$.params"), { name: "ProtocolFieldException", field: "$.params.lines" });
    for (const line of [-1, 1.5])
      assert.throws(() => GitLinesParams.fromJson({ ...json, lines: [0, line] }, "$.params"), { name: "ProtocolFieldException", field: "$.params.lines.1" });
    assert.throws(() => GitLinesParams.fromJson({ ...json, basedOn: "" }, "$.params"), { name: "ProtocolFieldException", field: "$.params.basedOn" });
    assert.throws(() => GitLinesParams.fromJson({ ...json, lines: undefined }), { name: "JsonException", path: "$.lines" });
    assert.throws(() => GitLinesParams.fromJson({ ...json, hunk: 0 }), { name: "ProtocolFieldException", field: "$.hunk" });
  });
});
