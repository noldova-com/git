/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { signal } from "@angular/core";
import { describe, expect, it } from "vitest";

import { GitRepositoryLink } from "../../../src/app/models/git-repository-link.ts";

describe("GitRepositoryLink", () => {
  it("keeps its key, label and icon, and opens through the callback it was given each time it's asked", () => {
    const opened: string[] = [];
    const link: GitRepositoryLink = new GitRepositoryLink("example.workItems", "Work items", "checklist", () => opened.push("work items"));

    link.open();
    link.open();

    expect([link.key, link.label, link.icon, opened]).toEqual(["example.workItems", "Work items", "checklist", ["work items", "work items"]]);
  });

  it("is never active without a signal saying so, and follows the one it was given", () => {
    const active = signal(true);
    const following: GitRepositoryLink = new GitRepositoryLink("example.workItems", "Work items", "checklist", () => undefined, active);
    const before: boolean = following.isActive();
    active.set(false);

    expect([new GitRepositoryLink("example.sprint", "Sprint", "view_kanban", () => undefined).isActive(), before, following.isActive()]).toEqual([false, true, false]);
  });
});
