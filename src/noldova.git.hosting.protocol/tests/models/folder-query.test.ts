/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";

import { describe, it } from "vitest";

import { FolderQuery, HostingFieldException } from "../../src/api/index.ts";

describe("FolderQuery", () => {
  it("returns its folder and remote as JSON that reads back the same", () => {
    const query: FolderQuery = new FolderQuery("/work/hello-world", "origin");

    assert.deepEqual(query.toJson(), { folder: "/work/hello-world", remote: "origin" });
    assert.deepEqual(FolderQuery.fromJson(JSON.parse(JSON.stringify(query.toJson()))), query);
  });

  it("refuses a blank folder or remote, naming the parameter", () => {
    assert.throws(() => new FolderQuery(" ", "origin"), { name: "HostingArgumentException", parameterName: "folder" });
    assert.throws(() => new FolderQuery("/work/hello-world", ""), { name: "HostingArgumentException", parameterName: "remote" });
  });

  it("refuses JSON with a field it doesn't define or a blank one, naming the field by its path", () => {
    assert.throws(() => FolderQuery.fromJson({ folder: "/work/a", remote: "origin", user: "kim" }), HostingFieldException);
    assert.throws(() => FolderQuery.fromJson({ folder: "/work/a", remote: " " }, "$.query"), { name: "HostingFieldException", field: "$.query.remote" });
    assert.throws(() => FolderQuery.fromJson({ remote: "origin" }), { name: "JsonException", path: "$.folder" });
  });
});
