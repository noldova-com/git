/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";

import { describe, it } from "vitest";

import { HostingFieldException, HostPullRequestConflicts } from "../../src/api/index.ts";

function pathsOf(count: number): string[] {
  return Array.from({ length: count }, (_, i) => `src/file-${i}.ts`);
}

describe("HostPullRequestConflicts", () => {
  it("returns its paths and whether there are more as JSON that reads back the same, more only after 100", () => {
    const full = new HostPullRequestConflicts(pathsOf(100), true);

    assert.deepEqual(new HostPullRequestConflicts(["src/a.ts"], false).toJson(), { paths: ["src/a.ts"], hasMore: false });
    assert.deepEqual(HostPullRequestConflicts.fromJson(JSON.parse(JSON.stringify(full.toJson()))), full);
    assert.deepEqual([full.paths.length, full.hasMore, HostPullRequestConflicts.maximumCount], [100, true, 100]);
  });

  it("refuses a blank path, more than 100 paths, and more before 100", () => {
    assert.throws(() => new HostPullRequestConflicts(["a.ts", " "], false), { name: "HostingArgumentException", parameterName: "paths" });
    assert.throws(() => new HostPullRequestConflicts(pathsOf(101), true), { name: "HostingArgumentException", parameterName: "paths",
      message: "The argument paths is invalid: expected at most 100 conflicts." });
    assert.throws(() => new HostPullRequestConflicts(pathsOf(99), true), { name: "HostingArgumentException", parameterName: "hasMore",
      message: "The argument hasMore is invalid: expected more only after 100 conflicts." });
  });

  it("refuses JSON with a field it doesn't define or of the wrong type", () => {
    const json = new HostPullRequestConflicts(["a.ts"], false).toJson();

    assert.throws(() => HostPullRequestConflicts.fromJson({ ...json, total: 1 }), HostingFieldException);
    assert.throws(() => HostPullRequestConflicts.fromJson({ ...json, paths: [1] }), { name: "JsonException" });
    assert.throws(() => HostPullRequestConflicts.fromJson({ ...json, paths: [""] }), { name: "HostingFieldException", field: "$.paths" });
  });
});
