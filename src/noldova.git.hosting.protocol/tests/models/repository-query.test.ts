/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";

import { describe, it } from "vitest";

import { HostingFieldException, RepositoryQuery } from "../../src/api/index.ts";

describe("RepositoryQuery", () => {
  it("returns its host and path as JSON that reads back the same", () => {
    const query: RepositoryQuery = new RepositoryQuery("dev.azure.com", "fabrikam/web/_git/site");

    assert.deepEqual(query.toJson(), { host: "dev.azure.com", path: "fabrikam/web/_git/site" });
    assert.deepEqual(RepositoryQuery.fromJson(JSON.parse(JSON.stringify(query.toJson()))), query);
  });

  it("refuses a blank host or a path with a '.' or '..' name, naming the parameter", () => {
    assert.throws(() => new RepositoryQuery(" ", "octocat/hello-world"), { name: "HostingArgumentException", parameterName: "host" });
    assert.throws(() => new RepositoryQuery("github.com", "octocat/.."), { name: "HostingArgumentException", parameterName: "path" });
  });

  it("refuses JSON with a field it doesn't define or out of its range, naming the field by its path", () => {
    const json = new RepositoryQuery("github.com", "octocat/hello-world").toJson();

    assert.throws(() => RepositoryQuery.fromJson({ ...json, branch: "main" }), HostingFieldException);
    assert.throws(() => RepositoryQuery.fromJson({ ...json, path: "../x" }, "$.query"), { name: "HostingFieldException", field: "$.query.path" });
    assert.throws(() => RepositoryQuery.fromJson({ ...json, host: 7 }), { name: "JsonException", path: "$.host" });
  });
});
