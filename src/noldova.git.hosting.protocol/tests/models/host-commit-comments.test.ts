/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";

import { describe, it } from "vitest";

import { HostCommitComments, HostingFieldException } from "../../src/api/index.ts";

const PAGE: string = "https://github.com/octocat/hello-world/commit/9fceb02d0ae598e95dc970b74767f19372d61af8";

describe("HostCommitComments", () => {
  it("returns its count, whether the host's page was full and its page as JSON that reads back the same", () => {
    const capped: HostCommitComments = new HostCommitComments(100, true, PAGE);

    assert.deepEqual(new HostCommitComments(3, false, PAGE).toJson(), { count: 3, isCapped: false, url: PAGE });
    assert.deepEqual(HostCommitComments.fromJson(JSON.parse(JSON.stringify(capped.toJson()))), capped);
    assert.deepEqual([capped.count, capped.isCapped, capped.url, HostCommitComments.maximumCount, new HostCommitComments(4, true, PAGE).isCapped],
      [100, true, PAGE, 100, true]);
  });

  it("answers none with no comments, not capped and no page", () => {
    assert.deepEqual(HostCommitComments.none().toJson(), { count: 0, isCapped: false, url: null });
  });

  it("refuses a count out of range, a cap with no comments, a page without comments or comments without one, and a page that isn't https", () => {
    assert.throws(() => new HostCommitComments(101, true, PAGE), { name: "HostingArgumentException", parameterName: "count",
      message: "The argument count is invalid: expected at most 100 comments." });
    assert.throws(() => new HostCommitComments(-1, false, null), { name: "HostingArgumentException", parameterName: "count" });
    assert.throws(() => new HostCommitComments(1.5, false, PAGE), { name: "HostingArgumentException", parameterName: "count" });
    assert.throws(() => new HostCommitComments(0, true, null), { name: "HostingArgumentException", parameterName: "isCapped",
      message: "The argument isCapped is invalid: expected capped only with comments." });
    assert.throws(() => new HostCommitComments(0, false, PAGE), { name: "HostingArgumentException", parameterName: "url",
      message: "The argument url is invalid: expected a page exactly when there are comments." });
    assert.throws(() => new HostCommitComments(2, false, null), { name: "HostingArgumentException", parameterName: "url" });
    assert.throws(() => new HostCommitComments(2, false, "http://github.com/octocat/hello-world"), { name: "HostingArgumentException", parameterName: "url" });
  });

  it("refuses JSON with a field it doesn't define or out of its range, naming the field by its path", () => {
    const json = new HostCommitComments(3, false, PAGE).toJson();

    assert.throws(() => HostCommitComments.fromJson({ ...json, total: 3 }), HostingFieldException);
    assert.throws(() => HostCommitComments.fromJson({ ...json, url: null }, "$.comments"), { name: "HostingFieldException", field: "$.comments.url" });
    assert.throws(() => HostCommitComments.fromJson({ ...json, isCapped: "no" }), { name: "JsonException", path: "$.isCapped" });
  });
});
