/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";

import { describe, it } from "vitest";

import { HostingFieldException, HostPullRequestCommit } from "../../src/api/index.ts";

const ID: string = "9fceb02d0ae598e95dc970b74767f19372d61af8";
const AT: number = Date.UTC(2026, 10, 23, 10);

describe("HostPullRequestCommit", () => {
  it("returns its id, subject, author and time as JSON that reads back the same, an empty subject too", () => {
    const commit = new HostPullRequestCommit(ID, "", "Mona Lisa", AT);

    assert.deepEqual(new HostPullRequestCommit(ID, "Fix the build", "Mona Lisa", AT).toJson(),
      { id: ID, subject: "Fix the build", author: "Mona Lisa", authoredAt: AT });
    assert.deepEqual(HostPullRequestCommit.fromJson(JSON.parse(JSON.stringify(commit.toJson()))), commit);
  });

  it("refuses an id that isn't a commit, a blank author and a time that isn't positive", () => {
    assert.throws(() => new HostPullRequestCommit("9fceb02", "x", "Ana", AT), { name: "HostingArgumentException", parameterName: "id" });
    assert.throws(() => new HostPullRequestCommit(ID, "x", " ", AT), { name: "HostingArgumentException", parameterName: "author" });
    assert.throws(() => new HostPullRequestCommit(ID, "x", "Ana", 0), { name: "HostingArgumentException", parameterName: "authoredAt" });
  });

  it("refuses JSON with a field it doesn't define or of the wrong type, naming the field by its path", () => {
    const json = new HostPullRequestCommit(ID, "x", "Ana", AT).toJson();

    assert.throws(() => HostPullRequestCommit.fromJson({ ...json, email: "a@b" }), HostingFieldException);
    assert.throws(() => HostPullRequestCommit.fromJson({ ...json, id: "x" }, "$.commits[0]"), { name: "HostingFieldException", field: "$.commits[0].id" });
    assert.throws(() => HostPullRequestCommit.fromJson({ ...json, authoredAt: "now" }), { name: "JsonException", path: "$.authoredAt" });
  });
});
