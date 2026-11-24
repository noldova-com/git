/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";

import { describe, it } from "vitest";

import { HostingFieldException, HostReference, HostReviewRequest, HostReviewRequestList } from "../../src/api/index.ts";

function rowsOf(count: number): HostReviewRequest[] {
  return Array.from({ length: count }, (_t, i) => new HostReviewRequest(new HostReference("git-github", "octocat", "hello-world", i + 1), `Change ${i + 1}`,
    `https://github.com/octocat/hello-world/pull/${i + 1}`, false, 1_700_000_000_000 + i));
}

describe("HostReviewRequestList", () => {
  it("returns its rows, whether the answer was cut and whether signed in as JSON that reads back the same, signed in by default", () => {
    const cut: HostReviewRequestList = new HostReviewRequestList(rowsOf(3), true);
    const rows: HostReviewRequest[] = rowsOf(2);

    assert.deepEqual(new HostReviewRequestList(rows, false).toJson(), { rows: rows.map(t => t.toJson()), hasMore: false, isSignedIn: true });
    assert.deepEqual(HostReviewRequestList.fromJson(JSON.parse(JSON.stringify(cut.toJson()))), cut);
    assert.deepEqual([cut.rows.length, cut.hasMore, cut.isSignedIn, HostReviewRequestList.maximumRows, new HostReviewRequestList(rowsOf(100), false).rows.length],
      [3, true, true, 100, 100]);
  });

  it("answers signed out with no rows and none more", () => {
    assert.deepEqual(HostReviewRequestList.signedOut().toJson(), { rows: [], hasMore: false, isSignedIn: false });
  });

  it("refuses more than 100 rows, rows while signed out, and more while signed out, naming the parameter", () => {
    assert.throws(() => new HostReviewRequestList(rowsOf(101), false), { name: "HostingArgumentException", parameterName: "rows",
      message: "The argument rows is invalid: expected at most 100 review requests, and none while signed out." });
    assert.throws(() => new HostReviewRequestList(rowsOf(1), false, false), { name: "HostingArgumentException", parameterName: "rows" });
    assert.throws(() => new HostReviewRequestList([], true, false), { name: "HostingArgumentException", parameterName: "hasMore",
      message: "The argument hasMore is invalid: expected more only while signed in." });
  });

  it("refuses JSON with a field it doesn't define or out of its range, naming the field by its path", () => {
    const json = new HostReviewRequestList(rowsOf(1), false).toJson();

    assert.throws(() => HostReviewRequestList.fromJson({ ...json, total: 1 }), HostingFieldException);
    assert.throws(() => HostReviewRequestList.fromJson({ rows: [], hasMore: true, isSignedIn: false }, "$.list"), { name: "HostingFieldException", field: "$.list.hasMore" });
    assert.throws(() => HostReviewRequestList.fromJson({ ...json, rows: [{ ...rowsOf(1)[0]?.toJson(), createdAt: 0 }] }),
      { name: "HostingFieldException", field: "$.rows.0.createdAt" });
    assert.throws(() => HostReviewRequestList.fromJson({ ...json, isSignedIn: 1 }), { name: "JsonException", path: "$.isSignedIn" });
  });
});
