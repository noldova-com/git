/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { HostWorkItem, HostWorkItemDetail } from "@noldova/git.hosting.protocol";

import { WorkItemFacet } from "../enums/work-item-facet.ts";

/**
 * The values the My work items page's chips chose, one for each facet, null showing every value. A work item's value for a facet is its state or its
 * type's name.
 */
export class WorkItemFilter {
  public static readonly none: WorkItemFilter = new WorkItemFilter(new Map());

  private readonly chosen: ReadonlyMap<WorkItemFacet, string>;

  private constructor(chosen: ReadonlyMap<WorkItemFacet, string>) {
    this.chosen = chosen;
  }

  /** The value chosen for a facet, or null for every value. */
  public of(facet: WorkItemFacet): string | null {
    return this.chosen.get(facet) ?? null;
  }

  /** This filter with a facet's value chosen, or with every value for null. */
  public with(facet: WorkItemFacet, value: string | null): WorkItemFilter {
    const chosen: Map<WorkItemFacet, string> = new Map(this.chosen);
    if (value === null)
      chosen.delete(facet);
    else
      chosen.set(facet, value);
    return new WorkItemFilter(chosen);
  }

  /** The work items that have every chosen value, in their order. */
  public apply(details: readonly HostWorkItemDetail[]): readonly HostWorkItemDetail[] {
    return details.filter(t => [...this.chosen].every(([facet, value]) => WorkItemFilter.valueOf(t.item, facet) === value));
  }

  /** The values a facet takes among the work items, each once, sorted. */
  public static choicesOf(details: readonly HostWorkItemDetail[], facet: WorkItemFacet): readonly string[] {
    return [...new Set(details.map(t => WorkItemFilter.valueOf(t.item, facet)))].sort((a, b) => a.localeCompare(b));
  }

  public static valueOf(item: HostWorkItem, facet: WorkItemFacet): string {
    switch (facet) {
      case WorkItemFacet.State:
        return item.state;
      case WorkItemFacet.Type:
        return item.type.name;
    }
  }
}
