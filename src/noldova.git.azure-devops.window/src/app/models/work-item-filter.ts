/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import type { HostWorkItem, HostWorkItemDetail } from "@noldova/git.hosting.protocol";

import { WorkItemFacet } from "../enums/work-item-facet.ts";

export class WorkItemFilter {
  public static readonly none: WorkItemFilter = new WorkItemFilter(new Map());

  private readonly chosen: ReadonlyMap<WorkItemFacet, string>;

  private constructor(chosen: ReadonlyMap<WorkItemFacet, string>) {
    this.chosen = chosen;
  }

  public of(facet: WorkItemFacet): string | null {
    return this.chosen.get(facet) ?? null;
  }

  public with(facet: WorkItemFacet, value: string | null): WorkItemFilter {
    const chosen: Map<WorkItemFacet, string> = new Map(this.chosen);
    if (Object.isNull(value))
      chosen.delete(facet);
    else
      chosen.set(facet, value);
    return new WorkItemFilter(chosen);
  }

  public apply(details: readonly HostWorkItemDetail[]): readonly HostWorkItemDetail[] {
    return details.filter(t => [...this.chosen].every(([facet, value]) => WorkItemFilter.valueOf(t.item, facet) === value));
  }

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
