/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";

import { describe, it } from "vitest";

import { HostingFieldException, HostPullRequestList, HostPullRequestRow, HostReference } from "../../src/api/index.ts";

function rowsOf(count: number): HostPullRequestRow[] {
  return Array.from({ length: count }, (_t, i) => new HostPullRequestRow(new HostReference("git-github", "octocat", "hello-world", i + 1), `Change ${i + 1}`,
    `https://github.com/octocat/hello-world/pull/${i + 1}`, false, 0, 0, 0, 0, `change-${i + 1}`));
}

describe("HostPullRequestList", () => {
  it("returns its rows, whether there are more and whether signed in as JSON that reads back the same, signed in by default", () => {
    const list: HostPullRequestList = new HostPullRequestList(rowsOf(20), true);
    const rows: HostPullRequestRow[] = rowsOf(2);

    assert.deepEqual(new HostPullRequestList(rows, false).toJson(), { rows: rows.map(t => t.toJson()), hasMore: false, isSignedIn: true });
    assert.deepEqual(HostPullRequestList.fromJson(JSON.parse(JSON.stringify(list.toJson()))), list);
    assert.deepEqual([list.rows.length, list.hasMore, list.isSignedIn, HostPullRequestList.maximumRows], [20, true, true, 20]);
  });

  it("answers signed out with no rows and none more", () => {
    assert.deepEqual(HostPullRequestList.signedOut().toJson(), { rows: [], hasMore: false, isSignedIn: false });
  });

  it("refuses more than 20 rows, rows while signed out, and more after fewer than 20 rows, naming the parameter", () => {
    assert.throws(() => new HostPullRequestList(rowsOf(21), false), { name: "HostingArgumentException", parameterName: "rows",
      message: "The argument rows is invalid: expected at most 20 pull requests, and none while signed out." });
    assert.throws(() => new HostPullRequestList(rowsOf(1), false, false), { name: "HostingArgumentException", parameterName: "rows" });
    assert.throws(() => new HostPullRequestList(rowsOf(19), true), { name: "HostingArgumentException", parameterName: "hasMore",
      message: "The argument hasMore is invalid: expected more only after 20 pull requests." });
  });

  it("refuses JSON with a field it doesn't define or out of its range, naming the field by its path", () => {
    const json = new HostPullRequestList(rowsOf(1), false).toJson();

    assert.throws(() => HostPullRequestList.fromJson({ ...json, total: 1 }), HostingFieldException);
    assert.throws(() => HostPullRequestList.fromJson({ ...json, hasMore: true }, "$.list"), { name: "HostingFieldException", field: "$.list.hasMore" });
    assert.throws(() => HostPullRequestList.fromJson({ ...json, rows: [{ ...rowsOf(1)[0]?.toJson(), failing: -1 }] }),
      { name: "HostingFieldException", field: "$.rows.0.failing" });
    assert.throws(() => HostPullRequestList.fromJson({ ...json, isSignedIn: 1 }), { name: "JsonException", path: "$.isSignedIn" });
  });
});
