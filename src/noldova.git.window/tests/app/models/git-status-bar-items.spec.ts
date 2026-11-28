/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { StatusBarItem, StatusBarItemContribution, StatusBarItemState, StatusBarSide } from "@noldova/desktop.window";
import { FakeTimeFormats } from "@noldova/desktop.window/testing";
import { describe, expect, it } from "vitest";

import { GitStatusBarItems } from "../../../src/app/models/git-status-bar-items.ts";

describe("GitStatusBarItems", () => {
  it("holds the branch, fetch and command items, and the dates the fetch item's tooltip shows its time by", () => {
    const item = (name: string): StatusBarItem => new StatusBarItem(new StatusBarItemContribution(name, StatusBarSide.Left, new StatusBarItemState("Starting")), () => undefined);
    const branch: StatusBarItem = item("git.branch");
    const fetched: StatusBarItem = item("git.fetched");
    const command: StatusBarItem = item("git.lastCommand");
    const dates = new FakeTimeFormats().service;
    const value: GitStatusBarItems = new GitStatusBarItems(branch, fetched, command, dates);

    expect([value.branch, value.fetched, value.command, value.dates]).toEqual([branch, fetched, command, dates]);
  });
});
