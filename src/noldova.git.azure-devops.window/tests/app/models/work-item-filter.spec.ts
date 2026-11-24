/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { HostPerson, HostWorkItem, HostWorkItemDetail, HostWorkItemType, WorkItemCategory } from "@noldova/git.hosting.protocol";
import { describe, expect, it } from "vitest";

import { WorkItemFacet } from "../../../src/app/enums/work-item-facet.ts";
import { WorkItemFilter } from "../../../src/app/models/work-item-filter.ts";

const task: HostWorkItemType = new HostWorkItemType("Task", "A4880A", "icon_clipboard");
const bug: HostWorkItemType = new HostWorkItemType("Bug", "CC293D", "icon_insect");
const monalisa: HostPerson = new HostPerson("monalisa", null, null);
const octocat: HostPerson = new HostPerson("octocat", null, null);

function detail(id: number, type: HostWorkItemType, state: string, assignee: HostPerson | null, iteration: string | null): HostWorkItemDetail {
  const item = new HostWorkItem("git-azure-devops", "fabrikam", "Sample Project", id, type, `Item ${id}`, state, WorkItemCategory.InProgress,
    `https://dev.azure.com/fabrikam/Sample%20Project/_workitems/edit/${id}`, assignee, iteration, null, null);
  return new HostWorkItemDetail(item, null, null, null, null, null, [], [], 0, []);
}

const details: readonly HostWorkItemDetail[] = [
  detail(4830, task, "Active", monalisa, "Sample Project\\Sprint 47"),
  detail(4799, bug, "Resolved", octocat, "Sample Project\\Sprint 47"),
  detail(4832, task, "New", null, "Sample Project\\Sprint 48"),
  detail(4811, bug, "Active", monalisa, null)
];

function idsOf(shown: readonly HostWorkItemDetail[]): readonly number[] {
  return shown.map(t => t.item.id);
}

describe("WorkItemFilter", () => {
  it("shows every work item, in its order, with nothing chosen", () => {
    expect([idsOf(WorkItemFilter.none.apply(details)), Object.values(WorkItemFacet).map(t => WorkItemFilter.none.of(t))])
      .toEqual([[4830, 4799, 4832, 4811], [null, null]]);
  });

  it("shows only the work items with each chosen state and type", () => {
    const filters: readonly WorkItemFilter[] = [WorkItemFilter.none.with(WorkItemFacet.State, "Active"), WorkItemFilter.none.with(WorkItemFacet.Type, "Bug"),
      WorkItemFilter.none.with(WorkItemFacet.State, "Active").with(WorkItemFacet.Type, "Bug")];

    expect(filters.map(t => idsOf(t.apply(details)))).toEqual([[4830, 4811], [4799, 4811], [4811]]);
  });

  it("shows every value again once a facet's choice is cleared, keeping the others", () => {
    const filter: WorkItemFilter = WorkItemFilter.none.with(WorkItemFacet.State, "Active").with(WorkItemFacet.Type, "Bug").with(WorkItemFacet.State, null);

    expect([filter.of(WorkItemFacet.State), filter.of(WorkItemFacet.Type), idsOf(filter.apply(details))]).toEqual([null, "Bug", [4799, 4811]]);
  });

  it("gives each facet's values once, sorted", () => {
    expect(Object.values(WorkItemFacet).map(t => WorkItemFilter.choicesOf(details, t))).toEqual([["Bug", "Task"], ["Active", "New", "Resolved"]]);
  });
});
