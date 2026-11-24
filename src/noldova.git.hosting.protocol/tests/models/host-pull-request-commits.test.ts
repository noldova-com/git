/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";

import { describe, it } from "vitest";

import { HostingFieldException, HostPullRequestCommit, HostPullRequestCommits } from "../../src/api/index.ts";

const ID: string = "9fceb02d0ae598e95dc970b74767f19372d61af8";
const AT: number = Date.UTC(2026, 10, 23, 10);

function commitsOf(count: number): HostPullRequestCommit[] {
  return Array.from({ length: count }, () => new HostPullRequestCommit(ID, "Fix the build", "Mona Lisa", AT));
}

describe("HostPullRequestCommits", () => {
  it("returns its commits and whether there are more as JSON that reads back the same, more only after 250", () => {
    const full = new HostPullRequestCommits(commitsOf(250), true);

    assert.deepEqual(new HostPullRequestCommits(commitsOf(1), false).toJson(), { commits: [{ id: ID, subject: "Fix the build", author: "Mona Lisa", authoredAt: AT }],
      hasMore: false });
    assert.deepEqual(HostPullRequestCommits.fromJson(JSON.parse(JSON.stringify(full.toJson()))), full);
    assert.deepEqual([full.commits.length, full.hasMore, HostPullRequestCommits.maximumCount], [250, true, 250]);
  });

  it("refuses more than 250 commits, and more before 250", () => {
    assert.throws(() => new HostPullRequestCommits(commitsOf(251), true), { name: "HostingArgumentException", parameterName: "commits",
      message: "The argument commits is invalid: expected at most 250 commits." });
    assert.throws(() => new HostPullRequestCommits(commitsOf(249), true), { name: "HostingArgumentException", parameterName: "hasMore",
      message: "The argument hasMore is invalid: expected more only after 250 commits." });
  });

  it("refuses JSON with a field it doesn't define, naming a commit's field by its path", () => {
    const json = new HostPullRequestCommits(commitsOf(1), false).toJson();

    assert.throws(() => HostPullRequestCommits.fromJson({ ...json, total: 1 }), HostingFieldException);
    assert.throws(() => HostPullRequestCommits.fromJson({ commits: [{ id: "x", subject: "", author: "Kim", authoredAt: AT }], hasMore: false }),
      { name: "HostingFieldException", field: "$.commits.0.id" });
  });
});
