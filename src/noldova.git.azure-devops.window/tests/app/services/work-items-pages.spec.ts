/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { signal } from "@angular/core";
import { describe, expect, it } from "vitest";

import { WorkItemsPlace } from "../../../src/app/models/work-items-place.ts";
import { WorkItemsPages } from "../../../src/app/services/work-items-pages.ts";

describe("WorkItemsPages", () => {
  it("says a project's page is in front only while a page showing that project, at any work item, is the active document and followed", () => {
    const place = signal<WorkItemsPlace | null>(null);
    const active = signal(true);
    const unfollow = WorkItemsPages.follow(place, active);
    const other = WorkItemsPages.follow(signal(new WorkItemsPlace("fabrikam", "Other", null)), signal(false));
    const isActive = WorkItemsPages.isActive("fabrikam", "Web");
    const looks: boolean[] = [isActive()];
    place.set(new WorkItemsPlace("fabrikam", "Web", 7402));
    looks.push(isActive(), WorkItemsPages.isActive("fabrikam", "Other")(), WorkItemsPages.isActive("contoso", "Web")());
    active.set(false);
    looks.push(isActive());
    active.set(true);
    looks.push(isActive());
    unfollow();
    other();
    looks.push(isActive());

    expect(looks).toEqual([false, true, false, false, false, true, false]);
  });
});
