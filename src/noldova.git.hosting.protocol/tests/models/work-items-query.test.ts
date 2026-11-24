/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";

import { describe, it } from "vitest";

import { HostingArgumentException, HostingFieldException, WorkItemScope, WorkItemsQuery } from "../../src/api/index.ts";

const mine: WorkItemsQuery = new WorkItemsQuery("git-azure-devops", "fabrikam", "Web Site", WorkItemScope.Mine, []);

describe("WorkItemsQuery", () => {
  it("returns each scope's parts as JSON that reads back the same", () => {
    const queries: readonly WorkItemsQuery[] = [mine, new WorkItemsQuery("git-azure-devops", "fabrikam", "Web Site", WorkItemScope.Ids, [7530, 7531])];

    assert.deepEqual(mine.toJson(), { host: "git-azure-devops", organization: "fabrikam", project: "Web Site", scope: "Mine", ids: [] });
    for (const query of queries)
      assert.deepEqual(WorkItemsQuery.fromJson(JSON.parse(JSON.stringify(query.toJson()))), query);
  });

  it("keeps its own copy of the ids", () => {
    const ids: number[] = [7530];
    const query: WorkItemsQuery = new WorkItemsQuery("git-azure-devops", "fabrikam", "Web Site", WorkItemScope.Ids, ids);

    ids.push(7531);

    assert.deepEqual(query.ids, [7530]);
  });

  it("refuses a host or organization that isn't a name and a blank project, naming the parameter", () => {
    assert.throws(() => new WorkItemsQuery("git azure", "fabrikam", "Web Site", WorkItemScope.Mine, []), HostingArgumentException);
    assert.throws(() => new WorkItemsQuery("git-azure-devops", "..", "Web Site", WorkItemScope.Mine, []), { parameterName: "organization" });
    assert.throws(() => new WorkItemsQuery("git-azure-devops", "fabrikam", " ", WorkItemScope.Mine, []), { parameterName: "project" });
  });

  it("refuses ids outside the Ids scope, none in it, an id twice and an id that isn't above zero", () => {
    const expected = { parameterName: "ids", message: "The argument ids is invalid: expected work item ids, each once, exactly for the Ids scope." };

    assert.throws(() => new WorkItemsQuery("git-azure-devops", "fabrikam", "Web Site", WorkItemScope.Ids, []), expected);
    assert.throws(() => new WorkItemsQuery("git-azure-devops", "fabrikam", "Web Site", WorkItemScope.Mine, [42]), expected);
    assert.throws(() => new WorkItemsQuery("git-azure-devops", "fabrikam", "Web Site", WorkItemScope.Ids, [42, 42]), expected);
    assert.throws(() => new WorkItemsQuery("git-azure-devops", "fabrikam", "Web Site", WorkItemScope.Ids, [0]), { parameterName: "ids" });
  });

  it("refuses JSON with a field it doesn't define, a scope it doesn't know or a field out of its range, naming the field by its path", () => {
    const json = mine.toJson();

    assert.throws(() => WorkItemsQuery.fromJson({ ...json, team: null }), HostingFieldException);
    assert.throws(() => WorkItemsQuery.fromJson({ ...json, scope: "Iteration" }, "$.query"), { name: "JsonException", path: "$.query.scope" });
    assert.throws(() => WorkItemsQuery.fromJson({ ...json, ids: [42] }, "$.query"), { name: "HostingFieldException", field: "$.query.ids" });
  });
});
