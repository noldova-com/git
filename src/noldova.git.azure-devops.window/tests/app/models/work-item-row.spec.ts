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
    const details: readonly HostWorkItemDetail[] = [detail(4702, null), detail(4821, 4790), detail(4790, 4702), detail(4830, 4821), detail(4811, null),
      detail(4799, 4790)];

    expect(shapeOf(WorkItemRow.rowsOf(details))).toEqual(["4702@0", "4790@1", "4821@2", "4830@3", "4799@2", "4811@0"]);
  });

  it("starts a work item whose parent wasn't read at the top level", () => {
    expect(shapeOf(WorkItemRow.rowsOf([detail(4830, 4821), detail(4831, 4830)]))).toEqual(["4830@0", "4831@1"]);
  });

  it("gives no rows for no work items", () => {
    expect(WorkItemRow.rowsOf([])).toEqual([]);
  });
});
