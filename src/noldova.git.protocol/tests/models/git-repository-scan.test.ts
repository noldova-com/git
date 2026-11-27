/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";

import { describe, it } from "vitest";

import { ScanEnd } from "../../src/enums/scan-end.ts";
import { GitRepositoryScan } from "../../src/models/git-repository-scan.ts";

describe("GitRepositoryScan", () => {
  it("keeps how the look ended and the repositories found, and reads back the same", () => {
    const found = new GitRepositoryScan(ScanEnd.Complete, ["/work/api", "C:\\work\\site"]);
    const inside = new GitRepositoryScan(ScanEnd.Repository, []);
    const most = new GitRepositoryScan(ScanEnd.RepositoryLimit, Array.from({ length: 1000 }, (_, index) => `/work/r${index}`));
    const cut = new GitRepositoryScan(ScanEnd.FolderLimit, ["/work/api"]);
    const unreadable = new GitRepositoryScan(ScanEnd.Unreadable, []);

    assert.deepEqual(found.toJson(), { end: "Complete", repositories: ["/work/api", "C:\\work\\site"] });
    assert.deepEqual(GitRepositoryScan.fromJson(JSON.parse(JSON.stringify(found.toJson()))), found);
    assert.deepEqual([inside, most, cut, unreadable].map(t => GitRepositoryScan.fromJson(t.toJson())), [inside, most, cut, unreadable]);
  });

  it("refuses more than 1000 repositories, any for a folder in a repository or unreadable, a folder that isn't absolute, a missing or wrong field and an unknown field, naming its path", () => {
    assert.throws(() => new GitRepositoryScan(ScanEnd.RepositoryLimit, Array.from({ length: 1001 }, (_, index) => `/work/r${index}`)),
      { name: "ProtocolFieldException", field: "repositories" });
    assert.throws(() => new GitRepositoryScan(ScanEnd.Repository, ["/work/a"]), { name: "ProtocolFieldException", field: "repositories" });
    assert.throws(() => GitRepositoryScan.fromJson({ end: "Unreadable", repositories: ["/work/a"] }), { name: "ProtocolFieldException", field: "$.repositories" });
    assert.throws(() => new GitRepositoryScan(ScanEnd.Complete, ["/work/a", "site"]), { name: "ProtocolFieldException", field: "repositories.1" });
    assert.throws(() => GitRepositoryScan.fromJson({ end: "Complete", repositories: [""] }), { name: "ProtocolFieldException", field: "$.repositories.0" });
    assert.throws(() => GitRepositoryScan.fromJson({ end: "Done", repositories: [] }), { name: "JsonException", path: "$.end" });
    assert.throws(() => GitRepositoryScan.fromJson({ end: "Complete" }), { name: "JsonException", path: "$.repositories" });
    assert.throws(() => GitRepositoryScan.fromJson({ end: "Complete", repositories: [], folders: [] }), { name: "ProtocolFieldException", field: "$.folders" });
  });
});
