/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";

import { describe, it } from "vitest";

import { FileChangeKind, HostingFieldException, HostPullRequestFile } from "../../src/api/index.ts";

describe("HostPullRequestFile", () => {
  it("returns its path, kind and previous path as JSON that reads back the same", () => {
    const moved = new HostPullRequestFile("src/new.ts", FileChangeKind.Renamed, "src/old.ts");

    assert.deepEqual(new HostPullRequestFile("src/a.ts", FileChangeKind.Added, null).toJson(), { path: "src/a.ts", kind: "Added", previousPath: null });
    assert.deepEqual(HostPullRequestFile.fromJson(JSON.parse(JSON.stringify(moved.toJson()))), moved);
  });

  it("refuses a blank path or previous path, a previous path on a file that didn't move, and a moved file without one", () => {
    assert.throws(() => new HostPullRequestFile(" ", FileChangeKind.Added, null), { name: "HostingArgumentException", parameterName: "path" });
    assert.throws(() => new HostPullRequestFile("a.ts", FileChangeKind.Renamed, " "), { name: "HostingArgumentException", parameterName: "previousPath" });
    assert.throws(() => new HostPullRequestFile("a.ts", FileChangeKind.Modified, "b.ts"), { name: "HostingArgumentException", parameterName: "previousPath",
      message: "The argument previousPath is invalid: expected a previous path for a moved file only." });
    assert.throws(() => new HostPullRequestFile("a.ts", FileChangeKind.Renamed, null), { name: "HostingArgumentException", parameterName: "previousPath" });
  });

  it("refuses JSON with a field it doesn't define or a kind it doesn't know, naming the field by its path", () => {
    const json = new HostPullRequestFile("a.ts", FileChangeKind.Deleted, null).toJson();

    assert.throws(() => HostPullRequestFile.fromJson({ ...json, size: 1 }), HostingFieldException);
    assert.throws(() => HostPullRequestFile.fromJson({ ...json, kind: "Copied" }), { name: "JsonException", path: "$.kind" });
    assert.throws(() => HostPullRequestFile.fromJson({ ...json, path: "" }, "$.files.0"), { name: "HostingFieldException", field: "$.files.0.path" });
  });
});
