/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";

import { describe, it } from "vitest";

import { CommitQuery, HostingArgumentException, HostingFieldException } from "../../src/api/index.ts";

const commit: string = "6dcb09b5b57875f334f61aebed695e2e4193db5e";
const query: CommitQuery = new CommitQuery("dev.azure.com", "fabrikam/Web/_git/web", commit);

describe("CommitQuery", () => {
  it("returns its parts as JSON that reads back the same", () => {
    assert.deepEqual(query.toJson(), { host: "dev.azure.com", path: "fabrikam/Web/_git/web", commit });
    assert.deepEqual(CommitQuery.fromJson(JSON.parse(JSON.stringify(query.toJson()))), query);
  });

  it("refuses a blank host, a path out of its range and a commit that isn't a full hash, naming the parameter", () => {
    assert.throws(() => new CommitQuery(" ", "octocat/hello-world", commit), HostingArgumentException);
    assert.throws(() => new CommitQuery(" ", "octocat/hello-world", commit), { name: "HostingArgumentException", parameterName: "host" });
    assert.throws(() => new CommitQuery("github.com", "octocat/..", commit), { name: "HostingArgumentException", parameterName: "path" });
    assert.throws(() => new CommitQuery("github.com", "octocat/hello-world", "6dcb09b"),
      { name: "HostingArgumentException", parameterName: "commit", message: "The argument commit is invalid: expected a full commit hash, 40 or 64 lowercase hexadecimal digits." });
  });

  it("refuses JSON with a field it doesn't define or out of its range, naming the field by its path", () => {
    const json = query.toJson();

    assert.throws(() => CommitQuery.fromJson({ ...json, branch: "main" }), HostingFieldException);
    assert.throws(() => CommitQuery.fromJson({ ...json, branch: "main" }), { name: "HostingFieldException", field: "$.branch" });
    assert.throws(() => CommitQuery.fromJson({ ...json, commit: commit.toUpperCase() }, "$.query"), { name: "HostingFieldException", field: "$.query.commit" });
    assert.throws(() => CommitQuery.fromJson({ ...json, commit: null }), { name: "JsonException", path: "$.commit" });
  });
});
