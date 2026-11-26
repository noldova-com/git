/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { HostWorkItem, HostWorkItemDetail, HostWorkItemType, WorkItemCategory } from "@noldova/git.hosting.protocol";
import { describe, expect, it } from "vitest";

import { WorkItemRow } from "../../../src/app/models/work-item-row.ts";

const task: HostWorkItemType = new HostWorkItemType("Task", "A4880A", "icon_clipboard");

function detail(id: number, parent: number | null): HostWorkItemDetail {
  const item = new HostWorkItem("git-azure-devops", "fabrikam", "Sample Project", id, task, `Item ${id}`, "Active", WorkItemCategory.InProgress,
    `https://dev.azure.com/fabrikam/Sample%20Project/_workitems/edit/${id}`, null, null, null, parent);
  return new HostWorkItemDetail(item, null, null, null, null, null, [], [], 0, []);
}

function shapeOf(rows: readonly WorkItemRow[]): readonly string[] {
  return rows.map(t => `${t.detail.item.id}@${t.depth}`);
}

describe("WorkItemRow", () => {
  it("places each work item under its parent, a level deeper, keeping the read's order among siblings", () => {
    const details: readonly HostWorkItemDetail[] = [detail(7402, null), detail(7521, 7490), detail(7490, 7402), detail(7530, 7521), detail(7511, null),
      detail(7499, 7490)];

    expect(shapeOf(WorkItemRow.rowsOf(details))).toEqual(["7402@0", "7490@1", "7521@2", "7530@3", "7499@2", "7511@0"]);
  });

  it("starts a work item whose parent wasn't read at the top level", () => {
    expect(shapeOf(WorkItemRow.rowsOf([detail(7530, 7521), detail(7531, 7530)]))).toEqual(["7530@0", "7531@1"]);
  });

  it("gives no rows for no work items", () => {
    expect(WorkItemRow.rowsOf([])).toEqual([]);
  });
});
