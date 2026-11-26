/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { computed, signal, type Signal, type WritableSignal } from "@angular/core";
import "@noldova/context.core";

import { FollowedPage } from "../models/followed-page.ts";
import type { WorkItemsPlace } from "../models/work-items-place.ts";

export class WorkItemsPages {
  private static readonly pages: WritableSignal<readonly FollowedPage[]> = signal<readonly FollowedPage[]>([]);

  public static follow(place: Signal<WorkItemsPlace | null>, active: Signal<boolean>): () => void {
    const page: FollowedPage = new FollowedPage(place, active);
    WorkItemsPages.pages.set([...WorkItemsPages.pages(), page]);
    return () => WorkItemsPages.pages.set(WorkItemsPages.pages().filter(t => t !== page));
  }

  public static isActive(organization: string, project: string): Signal<boolean> {
    return computed(() => WorkItemsPages.pages().some(({ place, active }) => {
      const shown: WorkItemsPlace | null = place();
      return active() && !Object.isNull(shown) && shown.organization === organization && shown.project === project;
    }));
  }
}
