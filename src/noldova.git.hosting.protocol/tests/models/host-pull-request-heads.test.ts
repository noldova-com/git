/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";

import { describe, it } from "vitest";

import { HostingFieldException, HostPullRequestHead, HostPullRequestHeads, HostReference } from "../../src/api/index.ts";

function rowsOf(count: number): HostPullRequestHead[] {
  return Array.from({ length: count }, (_t, i) => new HostPullRequestHead(new HostReference("git-azure-devops", "fabrikam", "site", i + 1), `Change ${i + 1}`,
    `https://dev.azure.com/fabrikam/web/_git/site/pullrequest/${i + 1}`, `change-${i + 1}`, "main"));
}

describe("HostPullRequestHeads", () => {
  it("returns its rows, whether there are more and whether signed in as JSON that reads back the same, signed in by default", () => {
    const heads: HostPullRequestHeads = new HostPullRequestHeads(rowsOf(100), true);
    const rows: HostPullRequestHead[] = rowsOf(2);

    assert.deepEqual(new HostPullRequestHeads(rows, false).toJson(), { rows: rows.map(t => t.toJson()), hasMore: false, isSignedIn: true });
    assert.deepEqual(HostPullRequestHeads.fromJson(JSON.parse(JSON.stringify(heads.toJson()))), heads);
    assert.deepEqual([heads.rows.length, heads.hasMore, heads.isSignedIn, HostPullRequestHeads.maximumRows], [100, true, true, 100]);
  });

  it("answers signed out with no rows and none more", () => {
    assert.deepEqual(HostPullRequestHeads.signedOut().toJson(), { rows: [], hasMore: false, isSignedIn: false });
  });

  it("refuses more than 100 rows, rows while signed out, and more after fewer than 100 rows, naming the parameter", () => {
    assert.throws(() => new HostPullRequestHeads(rowsOf(101), false), { name: "HostingArgumentException", parameterName: "rows",
      message: "The argument rows is invalid: expected at most 100 pull requests, and none while signed out." });
    assert.throws(() => new HostPullRequestHeads(rowsOf(1), false, false), { name: "HostingArgumentException", parameterName: "rows" });
    assert.throws(() => new HostPullRequestHeads(rowsOf(99), true), { name: "HostingArgumentException", parameterName: "hasMore",
      message: "The argument hasMore is invalid: expected more only after 100 pull requests." });
  });

  it("refuses JSON with a field it doesn't define or out of its range, naming the field by its path", () => {
    const json = new HostPullRequestHeads(rowsOf(1), false).toJson();

    assert.throws(() => HostPullRequestHeads.fromJson({ ...json, total: 1 }), HostingFieldException);
    assert.throws(() => HostPullRequestHeads.fromJson({ ...json, hasMore: true }, "$.heads"), { name: "HostingFieldException", field: "$.heads.hasMore" });
    assert.throws(() => HostPullRequestHeads.fromJson({ ...json, rows: [{ ...rowsOf(1)[0]?.toJson(), title: "" }] }),
      { name: "HostingFieldException", field: "$.rows.0.title" });
    assert.throws(() => HostPullRequestHeads.fromJson({ ...json, isSignedIn: 1 }), { name: "JsonException", path: "$.isSignedIn" });
  });
});
