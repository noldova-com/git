/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";

import { describe, it } from "vitest";

import { HostingFieldException, HostWorkItem, HostWorkItemDetail, HostWorkItemList, HostWorkItemType, WorkItemCategory } from "../../src/api/index.ts";

const task: HostWorkItemType = new HostWorkItemType("Task", "F2CB1D", "icon_clipboard");

function detailOf(id: number): HostWorkItemDetail {
  return new HostWorkItemDetail(new HostWorkItem("git-azure-devops", "fabrikam", "Sample Project", id, task, `Item ${id}`, "Active", WorkItemCategory.InProgress,
    `https://dev.azure.com/fabrikam/Sample%20Project/_workitems/edit/${id}`, null, null, null, null), null, null, null, null, null, [], [], 0, []);
}

describe("HostWorkItemList", () => {
  it("returns its work items and whether the search stopped at its limit as JSON that reads back the same", () => {
    const list: HostWorkItemList = new HostWorkItemList([detailOf(4830), detailOf(4831)], true);

    assert.deepEqual(list.toJson(), { items: [detailOf(4830).toJson(), detailOf(4831).toJson()], isTruncated: true });
    assert.deepEqual(HostWorkItemList.fromJson(JSON.parse(JSON.stringify(list.toJson()))), list);
    assert.deepEqual(HostWorkItemList.fromJson(new HostWorkItemList([], false).toJson()), new HostWorkItemList([], false));
  });

  it("keeps its own copy of the work items it was given", () => {
    const items: HostWorkItemDetail[] = [detailOf(4830)];
    const list: HostWorkItemList = new HostWorkItemList(items, false);
    items.push(detailOf(4831));

    assert.equal(list.items.length, 1);
  });

  it("refuses JSON with a field it doesn't define or of the wrong type, naming the field by its path", () => {
    const json = new HostWorkItemList([detailOf(4830)], false).toJson();

    assert.throws(() => HostWorkItemList.fromJson({ ...json, total: 1 }), HostingFieldException);
    assert.throws(() => HostWorkItemList.fromJson({ ...json, isTruncated: 1 }, "$.list"), { name: "JsonException", path: "$.list.isTruncated" });
    assert.throws(() => HostWorkItemList.fromJson({ ...json, items: [{ ...detailOf(4830).toJson(), commits: -1 }] }),
      { name: "HostingFieldException", field: "$.items.0.commits" });
  });
});
