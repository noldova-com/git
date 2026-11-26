/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";

import { describe, it } from "vitest";

import { HostingArgumentException, HostingFieldException, WorkItemQuery } from "../../src/api/index.ts";

const query: WorkItemQuery = new WorkItemQuery("git-azure-devops", "fabrikam", 42);

describe("WorkItemQuery", () => {
  it("returns its parts as JSON that reads back the same", () => {
    assert.deepEqual(query.toJson(), { host: "git-azure-devops", organization: "fabrikam", id: 42 });
    assert.deepEqual(WorkItemQuery.fromJson(JSON.parse(JSON.stringify(query.toJson()))), query);
  });

  it("refuses a host or organization that isn't a name and an id below one, naming the parameter", () => {
    assert.throws(() => new WorkItemQuery("", "fabrikam", 42), HostingArgumentException);
    assert.throws(() => new WorkItemQuery("git azure", "fabrikam", 42), { name: "HostingArgumentException", parameterName: "host" });
    assert.throws(() => new WorkItemQuery("git-azure-devops", "..", 42), { name: "HostingArgumentException", parameterName: "organization" });
    for (const id of [0, -1, 1.5, Number.MAX_SAFE_INTEGER + 1])
      assert.throws(() => new WorkItemQuery("git-azure-devops", "fabrikam", id), { name: "HostingArgumentException", parameterName: "id" }, String(id));
  });

  it("refuses JSON with a field it doesn't define or out of its range, naming the field by its path", () => {
    const json = query.toJson();

    assert.throws(() => WorkItemQuery.fromJson({ ...json, project: "web" }), HostingFieldException);
    assert.throws(() => WorkItemQuery.fromJson({ ...json, project: "web" }), { name: "HostingFieldException", field: "$.project" });
    assert.throws(() => WorkItemQuery.fromJson({ ...json, id: 0 }, "$.query"), { name: "HostingFieldException", field: "$.query.id" });
    assert.throws(() => WorkItemQuery.fromJson({ ...json, id: "42" }), { name: "JsonException", path: "$.id" });
  });
});
