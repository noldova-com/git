/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";

import { describe, it } from "vitest";

import { BranchQuery, HostingArgumentException, HostingFieldException } from "../../src/api/index.ts";

const commit: string = "6dcb09b5b57875f334f61aebed695e2e4193db5e";
const query: BranchQuery = new BranchQuery("git-github", "octocat/hello-world", "feature/readme", commit);

describe("BranchQuery", () => {
  it("returns its parts as JSON that reads back the same, with a head commit or without one", () => {
    const unpinned: BranchQuery = new BranchQuery("git-github", "octocat/hello-world", "feature/readme", null);

    assert.deepEqual(query.toJson(), { host: "git-github", path: "octocat/hello-world", branch: "feature/readme", headCommit: commit });
    assert.deepEqual(BranchQuery.fromJson(JSON.parse(JSON.stringify(query.toJson()))), query);
    assert.deepEqual(BranchQuery.fromJson(unpinned.toJson()), unpinned);
    assert.equal(unpinned.headCommit, null);
  });

  it("refuses a blank host, path or branch and a head commit that isn't a full hash, naming the parameter", () => {
    assert.throws(() => new BranchQuery(" ", "octocat/hello-world", "feature/readme", null), HostingArgumentException);
    assert.throws(() => new BranchQuery(" ", "octocat/hello-world", "feature/readme", null), { name: "HostingArgumentException", parameterName: "host" });
    assert.throws(() => new BranchQuery("git-github", "", "feature/readme", null), { name: "HostingArgumentException", parameterName: "path" });
    assert.throws(() => new BranchQuery("git-github", "octocat/hello-world", "\t", null), { name: "HostingArgumentException", parameterName: "branch" });
    assert.throws(() => new BranchQuery("git-github", "octocat/hello-world", "feature/readme", "6dcb09b"),
      { name: "HostingArgumentException", parameterName: "headCommit", message: "The argument headCommit is invalid: expected a full commit hash, 40 or 64 lowercase hexadecimal digits." });
  });

  it("refuses a path with a '.' or '..' name or characters outside a host's names", () => {
    for (const path of ["..", "../user", "octocat/..", "octocat/./hello-world", "octocat//hello-world", "octocat/hello world"])
      assert.throws(() => new BranchQuery("github.com", path, "fix-bug", null), { name: "HostingArgumentException", parameterName: "path" }, path);
    assert.throws(() => new BranchQuery("github.com", "..", "fix-bug", null),
      { name: "HostingArgumentException", parameterName: "path", message: "The argument path is invalid: expected names of letters, digits, '.', '_' and '-' joined by '/', none of them '.' or '..'." });
    assert.throws(() => BranchQuery.fromJson({ host: "github.com", path: "octocat/..", branch: "fix-bug", headCommit: null }), { name: "HostingFieldException", field: "$.path" });
    assert.equal(new BranchQuery("github.com", "octocat/hello-world.git", "fix-bug", null).path, "octocat/hello-world.git");
  });

  it("refuses JSON with a field it doesn't define or out of its range, naming the field by its path", () => {
    const json = query.toJson();

    assert.throws(() => BranchQuery.fromJson({ ...json, remote: "origin" }), HostingFieldException);
    assert.throws(() => BranchQuery.fromJson({ ...json, remote: "origin" }), { name: "HostingFieldException", field: "$.remote" });
    assert.throws(() => BranchQuery.fromJson({ ...json, branch: "" }, "$.query"), { name: "HostingFieldException", field: "$.query.branch" });
    assert.throws(() => BranchQuery.fromJson({ ...json, headCommit: commit.toUpperCase() }), { name: "HostingFieldException", field: "$.headCommit" });
    assert.throws(() => BranchQuery.fromJson({ ...json, headCommit: 7 }), { name: "JsonException", path: "$.headCommit" });
  });
});
