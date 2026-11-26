/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";

import { describe, it } from "vitest";

import { AuthorQuery } from "../../src/api/index.ts";

const commit: string = "6dcb09b5b57875f334f61aebed695e2e4193db5e";
const query: AuthorQuery = new AuthorQuery("git-github", "octocat/hello-world", "Kim@Example.com", commit);

describe("AuthorQuery", () => {
  it("returns its parts as JSON that reads back the same", () => {
    assert.deepEqual(query.toJson(), { host: "git-github", path: "octocat/hello-world", email: "Kim@Example.com", commit });
    assert.deepEqual(AuthorQuery.fromJson(JSON.parse(JSON.stringify(query.toJson()))), query);
  });

  it("refuses a blank host or email, a path outside a host's names and a commit that isn't a full hash, naming the parameter", () => {
    assert.throws(() => new AuthorQuery(" ", "octocat/hello-world", "kim@example.com", commit), { name: "HostingArgumentException", parameterName: "host" });
    assert.throws(() => new AuthorQuery("git-github", "octocat/..", "kim@example.com", commit), { name: "HostingArgumentException", parameterName: "path" });
    assert.throws(() => new AuthorQuery("git-github", "octocat/hello-world", "	", commit), { name: "HostingArgumentException", parameterName: "email" });
    assert.throws(() => new AuthorQuery("git-github", "octocat/hello-world", "kim@example.com", "6dcb09b"),
      { name: "HostingArgumentException", parameterName: "commit", message: "The argument commit is invalid: expected a full commit hash, 40 or 64 lowercase hexadecimal digits." });
  });

  it("refuses JSON with a field it doesn't define or out of its range, naming the field by its path", () => {
    const json = query.toJson();

    assert.throws(() => AuthorQuery.fromJson({ ...json, size: 64 }), { name: "HostingFieldException", field: "$.size" });
    assert.throws(() => AuthorQuery.fromJson({ ...json, email: "" }, "$.query"), { name: "HostingFieldException", field: "$.query.email" });
    assert.throws(() => AuthorQuery.fromJson({ ...json, commit: null }), { name: "JsonException", path: "$.commit" });
  });
});
