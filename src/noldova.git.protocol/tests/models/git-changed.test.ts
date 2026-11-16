/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";

import { describe, it } from "vitest";

import { GitChanged } from "../../src/models/git-changed.ts";

describe("GitChanged", () => {
  it("keeps the folder that changed, and reads back the same", () => {
    const changed = new GitChanged("/home/a/repo");

    assert.deepEqual(changed.toJson(), { folder: "/home/a/repo" });
    assert.deepEqual(GitChanged.fromJson(JSON.parse(JSON.stringify(changed.toJson()))), changed);
  });

  it("refuses a relative folder, a missing folder and an unknown field, naming its path", () => {
    assert.throws(() => new GitChanged("./repo"), { name: "ProtocolFieldException", field: "folder" });
    assert.throws(() => GitChanged.fromJson({ folder: "repo" }, "$.payload"), { name: "ProtocolFieldException", field: "$.payload.folder" });
    assert.throws(() => GitChanged.fromJson({ folder: 1 }), { name: "JsonException", path: "$.folder" });
    assert.throws(() => GitChanged.fromJson({ folder: "/repo", paths: [] }), { name: "ProtocolFieldException", field: "$.paths" });
  });
});
