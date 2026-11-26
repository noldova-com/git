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
import { WorkItemTableRow } from "../../../src/app/models/work-item-table-row.ts";

const story: HostWorkItemType = new HostWorkItemType("User Story", "009CCC", "icon_book");

function rowOf(id: number, depth: number): WorkItemRow {
  return new WorkItemRow(new HostWorkItemDetail(new HostWorkItem("git-azure-devops", "fabrikam", "Sample Project", id, story, `Item ${id}`, "Active",
    WorkItemCategory.InProgress, `https://dev.azure.com/fabrikam/Sample%20Project/_workitems/edit/${id}`, null, null, null, null), null, null, null, null, null,
  [], [], 0, []), depth);
}

const rows: readonly WorkItemRow[] = [rowOf(1, 0), rowOf(2, 1), rowOf(3, 2), rowOf(4, 1), rowOf(5, 0), rowOf(6, 0)];

interface IShownRow {
  readonly id: number;
  readonly hasChildren: boolean;
  readonly isCollapsed: boolean;
}

function shown(id: number, hasChildren: boolean, isCollapsed: boolean): IShownRow {
  return { id, hasChildren, isCollapsed };
}

function shownOf(collapsed: readonly number[]): readonly IShownRow[] {
  return WorkItemTableRow.shownOf(rows, new Set(collapsed)).map(t => shown(t.row.detail.item.id, t.hasChildren, t.isCollapsed));
}

describe("WorkItemTableRow", () => {
  it("shows every row with nothing collapsed, a row having children when the row after it is deeper", () => {
    expect(shownOf([])).toEqual([shown(1, true, false), shown(2, true, false), shown(3, false, false), shown(4, false, false), shown(5, false, false), shown(6, false, false)]);
  });

  it("leaves out every row under a collapsed one, down to the next row as shallow as it, and ignores a collapsed row without children", () => {
    expect([shownOf([2]), shownOf([1]), shownOf([1, 2]), shownOf([5])]).toEqual([
      [shown(1, true, false), shown(2, true, true), shown(4, false, false), shown(5, false, false), shown(6, false, false)],
      [shown(1, true, true), shown(5, false, false), shown(6, false, false)],
      [shown(1, true, true), shown(5, false, false), shown(6, false, false)],
      [shown(1, true, false), shown(2, true, false), shown(3, false, false), shown(4, false, false), shown(5, false, false), shown(6, false, false)]]);
  });
});
