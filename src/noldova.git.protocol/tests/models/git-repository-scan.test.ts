/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";

import { describe, it } from "vitest";

import { GitRepositoryScan } from "../../src/models/git-repository-scan.ts";

describe("GitRepositoryScan", () => {
  it("keeps whether the folder is a repository and the repositories found under it, and reads back the same", () => {
    const found = new GitRepositoryScan(false, ["/work/api", "C:\\work\\site"]);
    const inside = new GitRepositoryScan(true, []);
    const most = new GitRepositoryScan(false, Array.from({ length: 1000 }, (_, index) => `/work/r${index}`));

    assert.deepEqual(found.toJson(), { inRepository: false, repositories: ["/work/api", "C:\\work\\site"] });
    assert.deepEqual(GitRepositoryScan.fromJson(JSON.parse(JSON.stringify(found.toJson()))), found);
    assert.deepEqual([GitRepositoryScan.fromJson(inside.toJson()), most.repositories.length], [inside, 1000]);
  });

  it("refuses more than 1000 repositories, a folder that isn't absolute, a missing or wrong field and an unknown field, naming its path", () => {
    assert.throws(() => new GitRepositoryScan(false, Array.from({ length: 1001 }, (_, index) => `/work/r${index}`)), { name: "ProtocolFieldException", field: "repositories" });
    assert.throws(() => new GitRepositoryScan(false, ["/work/a", "site"]), { name: "ProtocolFieldException", field: "repositories.1" });
    assert.throws(() => GitRepositoryScan.fromJson({ inRepository: false, repositories: [""] }), { name: "ProtocolFieldException", field: "$.repositories.0" });
    assert.throws(() => GitRepositoryScan.fromJson({ inRepository: "no", repositories: [] }), { name: "JsonException", path: "$.inRepository" });
    assert.throws(() => GitRepositoryScan.fromJson({ inRepository: false }), { name: "JsonException", path: "$.repositories" });
    assert.throws(() => GitRepositoryScan.fromJson({ inRepository: false, repositories: [], folders: [] }), { name: "ProtocolFieldException", field: "$.folders" });
  });
});
