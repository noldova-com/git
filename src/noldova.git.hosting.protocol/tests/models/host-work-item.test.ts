/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";

import { describe, it } from "vitest";

import { HostPerson, HostWorkItem, HostWorkItemType, WorkItemCategory } from "../../src/api/index.ts";

const story: HostWorkItemType = new HostWorkItemType("User Story", "009CCC", "icon_book");
const url: string = "https://dev.azure.com/fabrikam/Web%20Site/_workitems/edit/42";
const item: HostWorkItem = new HostWorkItem("git-azure-devops", "fabrikam", "Web Site", 42, story, "Sign in with a work account", "Active",
  WorkItemCategory.InProgress, url, new HostPerson("monalisa", null, null), "Web Site\\Sprint 3", "Web Site\\Accounts", 7, 1_784_000_000_000);

function changed(changes: Record<string, unknown>): Record<string, unknown> {
  return { ...item.toJson(), ...changes };
}

describe("HostWorkItem", () => {
  it("holds a work item's type, state and category, assignee, iteration, area, parent and when it changed, and returns itself as JSON that reads back the same",
    () => {
    assert.deepEqual(item.toJson(), {
      host: "git-azure-devops", organization: "fabrikam", project: "Web Site", id: 42, type: story.toJson(), title: "Sign in with a work account",
      state: "Active", category: "InProgress", url, assignee: { login: "monalisa", avatar: null, url: null }, iteration: "Web Site\\Sprint 3",
      area: "Web Site\\Accounts", parent: 7, changedAt: 1_784_000_000_000
    });
    assert.deepEqual(HostWorkItem.fromJson(item.toJson()), item);
    const bare: HostWorkItem = new HostWorkItem("git-azure-devops", "fabrikam", "Web Site", 1, story, "New", "New", WorkItemCategory.Proposed, url, null, null,
      null, null);
    assert.deepEqual([HostWorkItem.fromJson(bare.toJson()), bare.changedAt], [bare, null]);
    const { changedAt: _, ...older } = item.toJson();
    assert.equal(HostWorkItem.fromJson(older).changedAt, null);
  });

  it("refuses each part out of its range, and a parent that is the item itself, naming the parameter", () => {
    const make = (host: string, organization: string, project: string, id: number, title: string, state: string, workItemUrl: string,
      iteration: string | null, area: string | null, parent: number | null): HostWorkItem =>
      new HostWorkItem(host, organization, project, id, story, title, state, WorkItemCategory.Proposed, workItemUrl, null, iteration, area, parent);

    assert.throws(() => make("a/b", "fabrikam", "Web", 1, "t", "s", url, null, null, null), { parameterName: "host" });
    assert.throws(() => make("git-azure-devops", "fab rikam", "Web", 1, "t", "s", url, null, null, null), { parameterName: "organization" });
    assert.throws(() => make("git-azure-devops", "fabrikam", " ", 1, "t", "s", url, null, null, null), { parameterName: "project" });
    assert.throws(() => make("git-azure-devops", "fabrikam", "Web", 0, "t", "s", url, null, null, null), { parameterName: "id" });
    assert.throws(() => make("git-azure-devops", "fabrikam", "Web", 1, " ", "s", url, null, null, null), { parameterName: "title" });
    assert.throws(() => make("git-azure-devops", "fabrikam", "Web", 1, "t", " ", url, null, null, null), { parameterName: "state" });
    assert.throws(() => make("git-azure-devops", "fabrikam", "Web", 1, "t", "s", "http://x", null, null, null), { parameterName: "url" });
    assert.throws(() => make("git-azure-devops", "fabrikam", "Web", 1, "t", "s", url, " ", null, null), { parameterName: "iteration" });
    assert.throws(() => make("git-azure-devops", "fabrikam", "Web", 1, "t", "s", url, null, " ", null), { parameterName: "area" });
    assert.throws(() => make("git-azure-devops", "fabrikam", "Web", 1, "t", "s", url, null, null, 0), { parameterName: "parent" });
    assert.throws(() => make("git-azure-devops", "fabrikam", "Web", 1, "t", "s", url, null, null, 1),
      { name: "HostingArgumentException", parameterName: "parent", message: "The argument parent is invalid: expected a parent other than the work item itself." });
    assert.throws(() => new HostWorkItem("git-azure-devops", "fabrikam", "Web", 1, story, "t", "s", WorkItemCategory.Proposed, url, null, null, null, null, 0),
      { parameterName: "changedAt" });
  });

  it("refuses JSON with a field it doesn't define, out of its range or a category it doesn't know, naming the field by its path", () => {
    assert.throws(() => HostWorkItem.fromJson(changed({ tags: [] })), { name: "HostingFieldException", field: "$.tags" });
    assert.throws(() => HostWorkItem.fromJson(changed({ parent: 42 }), "$.items.0"), { name: "HostingFieldException", field: "$.items.0.parent" });
    assert.throws(() => HostWorkItem.fromJson(changed({ changedAt: -1 })), { name: "HostingFieldException", field: "$.changedAt" });
    assert.throws(() => HostWorkItem.fromJson(changed({ type: { ...story.toJson(), color: "red" } })), { name: "HostingFieldException", field: "$.type.color" });
    assert.throws(() => HostWorkItem.fromJson(changed({ category: "Done" })), { name: "JsonException", path: "$.category" });
  });
});
