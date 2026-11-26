/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { Signal } from "@angular/core";

import type { WorkItemsPlace } from "./work-items-place.ts";

export class FollowedPage {
  public readonly place: Signal<WorkItemsPlace | null>;
  public readonly active: Signal<boolean>;

  public constructor(place: Signal<WorkItemsPlace | null>, active: Signal<boolean>) {
    this.place = place;
    this.active = active;
  }
}
