/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";

import { describe, it } from "vitest";

import { FileChangeKind, HostingFieldException, HostPullRequestFile, HostPullRequestFiles } from "../../src/api/index.ts";

const SOURCE: string = "9fceb02d0ae598e95dc970b74767f19372d61af8";
const COMMON: string = "0123456789abcdef0123456789abcdef01234567";

function filesOf(count: number): HostPullRequestFile[] {
  return Array.from({ length: count }, (_, i) => new HostPullRequestFile(`src/file-${i}.ts`, FileChangeKind.Modified, null));
}

describe("HostPullRequestFiles", () => {
  it("returns its commits, files and whether there are more as JSON that reads back the same, more also with fewer than 1000", () => {
    const full = new HostPullRequestFiles(SOURCE, COMMON, filesOf(1000), true);
    const fewer = new HostPullRequestFiles(SOURCE, null, filesOf(961), true);

    assert.deepEqual(new HostPullRequestFiles(SOURCE, null, filesOf(1), false).toJson(), { sourceCommit: SOURCE, commonCommit: null,
      files: [{ path: "src/file-0.ts", kind: "Modified", previousPath: null }], hasMore: false });
    assert.deepEqual(HostPullRequestFiles.fromJson(JSON.parse(JSON.stringify(full.toJson()))), full);
    assert.deepEqual([full.files.length, full.hasMore, HostPullRequestFiles.maximumCount], [1000, true, 1000]);
    assert.deepEqual(HostPullRequestFiles.fromJson(fewer.toJson()), fewer);
    assert.deepEqual(new HostPullRequestFiles(null, null, [], false).toJson(), { sourceCommit: null, commonCommit: null, files: [], hasMore: false });
  });

  it("refuses commits that aren't ids, a common commit, files or more without a head commit, and more than 1000 files", () => {
    assert.throws(() => new HostPullRequestFiles("x", null, [], false), { name: "HostingArgumentException", parameterName: "sourceCommit" });
    assert.throws(() => new HostPullRequestFiles(SOURCE, "x", [], false), { name: "HostingArgumentException", parameterName: "commonCommit" });
    assert.throws(() => new HostPullRequestFiles(null, COMMON, [], false), { name: "HostingArgumentException", parameterName: "sourceCommit",
      message: "The argument sourceCommit is invalid: expected a head commit for a common commit, files or more." });
    assert.throws(() => new HostPullRequestFiles(null, null, filesOf(1), false), { name: "HostingArgumentException", parameterName: "sourceCommit" });
    assert.throws(() => new HostPullRequestFiles(SOURCE, COMMON, filesOf(1001), true), { name: "HostingArgumentException", parameterName: "files",
      message: "The argument files is invalid: expected at most 1000 files." });
    assert.throws(() => new HostPullRequestFiles(null, null, [], true), { name: "HostingArgumentException", parameterName: "sourceCommit" });
  });

  it("refuses JSON with a field it doesn't define, naming a file's field by its path", () => {
    const json = new HostPullRequestFiles(SOURCE, COMMON, filesOf(1), false).toJson();

    assert.throws(() => HostPullRequestFiles.fromJson({ ...json, total: 1 }), HostingFieldException);
    assert.throws(() => HostPullRequestFiles.fromJson({ ...json, files: [{ path: "a.ts", kind: "Added", previousPath: "b.ts" }] }),
      { name: "HostingFieldException", field: "$.files.0.previousPath" });
  });
});
