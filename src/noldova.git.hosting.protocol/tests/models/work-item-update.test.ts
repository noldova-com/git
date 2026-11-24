/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";

import { describe, it } from "vitest";

import { HostingArgumentException, HostingFieldException, WorkItemUpdate } from "../../src/api/index.ts";

const update: WorkItemUpdate = new WorkItemUpdate("git-azure-devops", "fabrikam", 4832, "Active", true);

describe("WorkItemUpdate", () => {
  it("returns a new state, an assignment or both as JSON that reads back the same", () => {
    const updates: readonly WorkItemUpdate[] = [update, new WorkItemUpdate("git-azure-devops", "fabrikam", 4832, "Active", false),
      new WorkItemUpdate("git-azure-devops", "fabrikam", 4832, null, true)];

    assert.deepEqual(update.toJson(), { host: "git-azure-devops", organization: "fabrikam", id: 4832, state: "Active", assignToMe: true });
    for (const each of updates)
      assert.deepEqual(WorkItemUpdate.fromJson(JSON.parse(JSON.stringify(each.toJson()))), each);
  });

  it("refuses a host or organization that isn't a name, an id that isn't above zero and a blank state, naming the parameter", () => {
    assert.throws(() => new WorkItemUpdate("git azure", "fabrikam", 4832, "Active", false), HostingArgumentException);
    assert.throws(() => new WorkItemUpdate("git-azure-devops", "..", 4832, "Active", false), { parameterName: "organization" });
    assert.throws(() => new WorkItemUpdate("git-azure-devops", "fabrikam", 0, "Active", false), { parameterName: "id" });
    assert.throws(() => new WorkItemUpdate("git-azure-devops", "fabrikam", 4832, " ", true), { parameterName: "state" });
  });

  it("refuses an update that changes nothing", () => {
    assert.throws(() => new WorkItemUpdate("git-azure-devops", "fabrikam", 4832, null, false),
      { parameterName: "state", message: "The argument state is invalid: expected a new state, an assignment to the signed-in person, or both." });
  });

  it("refuses JSON with a field it doesn't define or that changes nothing, naming the field by its path", () => {
    assert.throws(() => WorkItemUpdate.fromJson({ ...update.toJson(), title: "x" }), HostingFieldException);
    assert.throws(() => WorkItemUpdate.fromJson({ ...update.toJson(), state: null, assignToMe: false }, "$.update"),
      { name: "HostingFieldException", field: "$.update.state" });
    assert.throws(() => WorkItemUpdate.fromJson({ ...update.toJson(), assignToMe: "yes" }), { name: "JsonException", path: "$.assignToMe" });
  });
});
