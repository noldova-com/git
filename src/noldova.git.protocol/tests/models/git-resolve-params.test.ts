/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";

import { describe, it } from "vitest";

import { ConflictResolution } from "../../src/enums/conflict-resolution.ts";
import { GitResolveParams } from "../../src/models/git-resolve-params.ts";

describe("GitResolveParams", () => {
  it("keeps a text resolution and reads back the same", () => {
    const params = new GitResolveParams("/repo", "a.ts", ConflictResolution.Text, "merged\n", "f1");

    assert.deepEqual(params.toJson(), { folder: "/repo", path: "a.ts", resolution: "Text", text: "merged\n", basedOn: "f1" });
    assert.deepEqual(GitResolveParams.fromJson(JSON.parse(JSON.stringify(params.toJson()))), params);
  });

  it("keeps a whole-side or delete resolution with no text, an empty text resolution, and reads them back", () => {
    for (const resolution of [ConflictResolution.Ours, ConflictResolution.Theirs, ConflictResolution.Delete]) {
      const params = new GitResolveParams("/repo", "a.ts", resolution, null, "f1");

      assert.deepEqual(GitResolveParams.fromJson(params.toJson()), params);
    }
    assert.equal(new GitResolveParams("/repo", "a.ts", ConflictResolution.Text, "", "f1").text, "");
  });

  it("refuses a text with a whole-side resolution, a Text resolution without one, and other invalid fields, naming their path", () => {
    assert.throws(() => new GitResolveParams("/repo", "a.ts", ConflictResolution.Ours, "x", "f"), { name: "ProtocolFieldException", field: "text" });
    assert.throws(() => new GitResolveParams("/repo", "a.ts", ConflictResolution.Text, null, "f"), { name: "ProtocolFieldException", field: "text" });
    assert.throws(() => new GitResolveParams("repo", "a.ts", ConflictResolution.Delete, null, "f"), { name: "ProtocolFieldException", field: "folder" });
    assert.throws(() => new GitResolveParams("/repo", "", ConflictResolution.Delete, null, "f"), { name: "ProtocolFieldException", field: "path" });
    assert.throws(() => new GitResolveParams("/repo", "a.ts", ConflictResolution.Delete, null, ""), { name: "ProtocolFieldException", field: "basedOn" });
    assert.throws(() => GitResolveParams.fromJson({ folder: "/repo", path: "a.ts", resolution: "Both", text: null, basedOn: "f" }),
      { name: "JsonException", path: "$.resolution" });
    assert.throws(() => GitResolveParams.fromJson({ folder: "/repo", path: "a.ts", resolution: "Theirs", text: "x", basedOn: "f" }, "$.params"),
      { name: "ProtocolFieldException", field: "$.params.text" });
    assert.throws(() => GitResolveParams.fromJson({ folder: "/repo", path: "a.ts", resolution: "Theirs", text: null, basedOn: "f", stage: true }),
      { name: "ProtocolFieldException", field: "$.stage" });
  });
});
