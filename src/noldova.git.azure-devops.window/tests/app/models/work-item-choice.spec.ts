/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { HostWorkItem, HostWorkItemDetail, HostWorkItemType, WorkItemCategory } from "@noldova/git.hosting.protocol";
import { describe, expect, it } from "vitest";

import { WorkItemChoice } from "../../../src/app/models/work-item-choice.ts";
import { WorkItemsPlace } from "../../../src/app/models/work-items-place.ts";

const detailOf = (id: number, parent: number | null): HostWorkItemDetail => new HostWorkItemDetail(new HostWorkItem("git-azure-devops", "fabrikam",
  "Sample Project", id, new HostWorkItemType("User Story", "009CCC", "icon_book"), "Export notes as Markdown files", "Active", WorkItemCategory.InProgress,
  `https://dev.azure.com/fabrikam/Sample%20Project/_workitems/edit/${id}`, null, null, null, parent), null, null, null, null, null, [], [], 0, []);

describe("WorkItemChoice", () => {
  it("holds the chosen work item's project, its detail and the work items read with it", () => {
    const place = new WorkItemsPlace("fabrikam", "Sample Project", 7521);
    const detail = detailOf(7521, 7490);
    const known = [detailOf(7490, null)];

    const choice = new WorkItemChoice(place, detail, known);

    expect([choice.place, choice.detail, choice.known]).toEqual([place, detail, known]);
  });
});
