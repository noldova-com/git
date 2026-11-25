/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { StatusBarItem, StatusBarItemContribution, StatusBarItemState, StatusBarSide } from "@noldova/desktop.window";
import { describe, expect, it } from "vitest";

import { GitStatusBarItems } from "../../../src/app/models/git-status-bar-items.ts";

describe("GitStatusBarItems", () => {
  it("holds the branch, fetch and command items", () => {
    const item = (name: string): StatusBarItem => new StatusBarItem(new StatusBarItemContribution(name, StatusBarSide.Left, new StatusBarItemState("Starting")), () => undefined);
    const branch: StatusBarItem = item("git.branch");
    const fetched: StatusBarItem = item("git.fetched");
    const command: StatusBarItem = item("git.lastCommand");
    const value: GitStatusBarItems = new GitStatusBarItems(branch, fetched, command);

    expect([value.branch, value.fetched, value.command]).toEqual([branch, fetched, command]);
  });
});
