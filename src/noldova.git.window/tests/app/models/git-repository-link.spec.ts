/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

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
});
