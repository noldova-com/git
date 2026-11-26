/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";

import type { WorkItemRow } from "./work-item-row.ts";

export class WorkItemTableRow {
  public readonly row: WorkItemRow;
  public readonly hasChildren: boolean;
  public readonly isCollapsed: boolean;

  public constructor(row: WorkItemRow, hasChildren: boolean, isCollapsed: boolean) {
    this.row = row;
    this.hasChildren = hasChildren;
    this.isCollapsed = isCollapsed;
  }

  public static shownOf(rows: readonly WorkItemRow[], collapsed: ReadonlySet<number>): readonly WorkItemTableRow[] {
    const shown: WorkItemTableRow[] = [];
    let hiddenUnder: number | null = null;
    for (const [index, row] of rows.entries()) {
      if (!Object.isNull(hiddenUnder) && row.depth > hiddenUnder)
        continue;
      hiddenUnder = null;
      const hasChildren: boolean = (rows[index + 1]?.depth ?? 0) > row.depth;
      const isCollapsed: boolean = hasChildren && collapsed.has(row.detail.item.id);
      if (isCollapsed)
        hiddenUnder = row.depth;
      shown.push(new WorkItemTableRow(row, hasChildren, isCollapsed));
    }
    return shown;
  }
}
