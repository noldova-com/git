/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { HostWorkItemDetail } from "@noldova/git.hosting.protocol";

import type { WorkItemsPlace } from "./work-items-place.ts";

export class WorkItemChoice {
  public readonly place: WorkItemsPlace;
  public readonly detail: HostWorkItemDetail;
  public readonly known: readonly HostWorkItemDetail[];

  public constructor(place: WorkItemsPlace, detail: HostWorkItemDetail, known: readonly HostWorkItemDetail[]) {
    this.place = place;
    this.detail = detail;
    this.known = known;
  }
}
