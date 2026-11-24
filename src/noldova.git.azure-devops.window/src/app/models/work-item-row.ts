/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { HostWorkItemDetail } from "@noldova/git.hosting.protocol";

export class WorkItemRow {
  public readonly detail: HostWorkItemDetail;
  public readonly depth: number;

  public constructor(detail: HostWorkItemDetail, depth: number) {
    this.detail = detail;
    this.depth = depth;
  }

  public static rowsOf(details: readonly HostWorkItemDetail[]): readonly WorkItemRow[] {
    const ids: ReadonlySet<number> = new Set(details.map(t => t.item.id));
    const rows: WorkItemRow[] = [];
    const place = (detail: HostWorkItemDetail, depth: number): void => {
      rows.push(new WorkItemRow(detail, depth));
      for (const child of details.filter(t => t.item.parent === detail.item.id))
        place(child, depth + 1);
    };
    for (const root of details.filter(t => t.item.parent === null || !ids.has(t.item.parent)))
      place(root, 0);
    return rows;
  }
}
