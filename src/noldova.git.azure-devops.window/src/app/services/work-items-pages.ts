/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { computed, signal, type Signal, type WritableSignal } from "@angular/core";

import type { WorkItemsPlace } from "../models/work-items-place.ts";

/** The My work items pages open, each with the project it shows and whether it's the window's active document, so a project's row can show it in front. */
export class WorkItemsPages {
  private static readonly pages: WritableSignal<readonly (readonly [Signal<WorkItemsPlace | null>, Signal<boolean>])[]> =
    signal<readonly (readonly [Signal<WorkItemsPlace | null>, Signal<boolean>])[]>([]);

  /** Adds a page, with the project it shows, null until it knows, until the returned function is called. */
  public static follow(place: Signal<WorkItemsPlace | null>, active: Signal<boolean>): () => void {
    const page: readonly [Signal<WorkItemsPlace | null>, Signal<boolean>] = [place, active];
    WorkItemsPages.pages.set([...WorkItemsPages.pages(), page]);
    return () => WorkItemsPages.pages.set(WorkItemsPages.pages().filter(t => t !== page));
  }

  /** Whether a page showing the project, at any of its work items, is the window's active document. */
  public static isActive(organization: string, project: string): Signal<boolean> {
    return computed(() => WorkItemsPages.pages().some(([place, active]) => {
      const shown: WorkItemsPlace | null = place();
      return active() && shown !== null && shown.organization === organization && shown.project === project;
    }));
  }
}
