/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { StatusBarItem, StatusBarItemContribution, StatusBarItemState, StatusBarSide } from "@noldova/desktop.window";
import { GitCommand, StatusUpstream } from "@noldova/git.protocol";
import { describe, expect, it, onTestFinished, vi } from "vitest";

import { GitStatusBar } from "../../../src/app/services/git-status-bar.ts";
import { GitFixtures } from "../../fixtures/git-fixtures.fixture.ts";

describe("GitStatusBar", () => {
  const itemOf = (name: string = "git.branch"): StatusBarItem =>
    new StatusBarItem(new StatusBarItemContribution(name, StatusBarSide.Left, new StatusBarItemState("Starting")), () => undefined);
  const fetchedAt: string = "2026-11-22T18:05:00Z";
  const after = (milliseconds: number): Date => new Date(Date.parse(fetchedAt) + milliseconds);
  const minute: number = 60_000;

  it("shows the branch with how far it is ahead of and behind its upstream, opening the folder's history", () => {
    const state: StatusBarItemState = GitStatusBar.stateOf("/work/site", GitFixtures.status([], new StatusUpstream("origin/main", 3, 1, false), { branch: "feature/graph" }));

    expect([state.text, state.icon, state.tooltip, state.command, state.commandArguments, state.isHidden]).toEqual([
      "feature/graph ↑3 ↓1", "call_split", "feature/graph, 3 ahead of and 1 behind origin/main. Open the history", "git.openHistory", { folder: "/work/site" }, false
    ]);
  });

  it("shows a branch without an upstream by its name, and a detached HEAD by its short id", () => {
    const plain: StatusBarItemState = GitStatusBar.stateOf("/work/site", GitFixtures.status());
    const detached: StatusBarItemState = GitStatusBar.stateOf("/work/site", GitFixtures.status([], null, { branch: null }));

    expect([plain.text, plain.tooltip]).toEqual(["main", "main, no upstream. Open the history"]);
    expect([detached.text, detached.icon]).toEqual(["Detached at 0123456", "adjust"]);
  });

  it("hides the item without a repository, without a status, or with neither a branch nor a commit", () => {
    expect([
      GitStatusBar.stateOf(null, GitFixtures.status()).isHidden,
      GitStatusBar.stateOf("/work/site", null).isHidden,
      GitStatusBar.stateOf("/work/site", GitFixtures.status([], null, { branch: null, head: null })).isHidden
    ]).toEqual([true, true, true]);
  });

  it("updates the item it was given, keeps a newer item when an older one is let go, and shows nothing once none is given", () => {
    const first: StatusBarItem = itemOf();
    const second: StatusBarItem = itemOf();
    const withdrawFirst: () => void = GitStatusBar.provide(first, itemOf("git.fetched"), itemOf("git.lastCommand"));
    const withdrawSecond: () => void = GitStatusBar.provide(second, itemOf("git.fetched"), itemOf("git.lastCommand"));
    onTestFinished(withdrawSecond);

    withdrawFirst();
    GitStatusBar.show("/work/site", GitFixtures.status());
    withdrawSecond();
    GitStatusBar.show("/work/site", null);

    expect([first.state().text, second.state().text]).toEqual(["Starting", "main"]);
  });

  it("says how long ago the repository fetched, in minutes, hours and days, with the time itself as the tooltip", () => {
    const status = GitFixtures.status([], null, { fetchedAt });
    const texts: string[] = [0, 59_999, minute, 2 * minute, 59 * minute, 60 * minute, 23 * 60 * minute, 24 * 60 * minute, 3 * 24 * 60 * minute, -5 * minute]
      .map(t => GitStatusBar.fetchedStateOf("/work/site", status, after(t)).text);

    expect(texts).toEqual([
      "Fetched just now", "Fetched just now", "Fetched 1 minute ago", "Fetched 2 minutes ago", "Fetched 59 minutes ago", "Fetched 1 hour ago", "Fetched 23 hours ago",
      "Fetched 1 day ago", "Fetched 3 days ago", "Fetched just now"
    ]);
    expect(GitStatusBar.fetchedStateOf("/work/site", status, after(0)).tooltip).toBe(`Last fetched ${new Date(fetchedAt).toLocaleString("en-US")}`);
  });

  it("hides the fetch item without a repository, without a status, or before the repository's first fetch", () => {
    expect([
      GitStatusBar.fetchedStateOf(null, GitFixtures.status([], null, { fetchedAt }), after(0)).isHidden,
      GitStatusBar.fetchedStateOf("/work/site", null, after(0)).isHidden,
      GitStatusBar.fetchedStateOf("/work/site", GitFixtures.status(), after(0)).isHidden
    ]).toEqual([true, true, true]);
  });

  it("shows the last command, cut past 60 characters, with how it ended in the tooltip, opening the folder's command log", () => {
    const push = new GitCommand("3", fetchedAt, "git push --porcelain --no-follow-tags --recurse-submodules=no -- origin 8c41e0a:refs/heads/feature", 1, 1_250);
    const state: StatusBarItemState = GitStatusBar.commandStateOf("/work/site", push);
    const short: StatusBarItemState = GitStatusBar.commandStateOf("/work/site", new GitCommand("4", fetchedAt, "git fetch --quiet", null, 30));

    expect([state.text, state.text.length, state.icon, state.tooltip, state.command, state.commandArguments]).toEqual([
      "git push --porcelain --no-follow-tags --recurse-submodules=…", 60, "receipt_long",
      `${push.line}\nExit code 1 in 1.3 s. Open the command log`, "git.openCommandLog", { folder: "/work/site" }
    ]);
    expect([short.text, short.tooltip]).toEqual(["git fetch --quiet", "git fetch --quiet\nDidn't finish in 30 ms. Open the command log"]);
  });

  it("names the command log before a folder's first command, and hides the command item without a folder", () => {
    const none: StatusBarItemState = GitStatusBar.commandStateOf("/work/site", null);

    expect([none.text, none.tooltip, none.isHidden, GitStatusBar.commandStateOf(null, null).isHidden]).toEqual(["Command log", "Open the command log", false, true]);
  });

  it("updates the command item it was given, and keeps the last command shown when the status moves", () => {
    const command: StatusBarItem = itemOf("git.lastCommand");
    const withdraw: () => void = GitStatusBar.provide(itemOf(), itemOf("git.fetched"), command);
    onTestFinished(withdraw);

    GitStatusBar.showCommand("/work/site", new GitCommand("1", fetchedAt, "git add -- a.txt", 0, 40));
    GitStatusBar.show("/work/site", GitFixtures.status());
    const shown: string = command.state().text;
    GitStatusBar.showCommand(null, null);

    expect([shown, command.state().isHidden]).toEqual(["git add -- a.txt", true]);
  });

  it("moves the fetch age on each minute while the items are given, and stops once they are let go", () => {
    vi.useFakeTimers({ now: after(0) });
    onTestFinished(() => {
      vi.useRealTimers();
    });
    const fetched: StatusBarItem = itemOf("git.fetched");
    const withdraw: () => void = GitStatusBar.provide(itemOf(), fetched, itemOf("git.lastCommand"));
    onTestFinished(withdraw);

    GitStatusBar.show("/work/site", GitFixtures.status([], null, { fetchedAt }));
    const shown: string = fetched.state().text;
    vi.advanceTimersByTime(2 * minute);
    const moved: string = fetched.state().text;
    withdraw();
    vi.advanceTimersByTime(5 * minute);

    expect([shown, moved, fetched.state().text]).toEqual(["Fetched just now", "Fetched 2 minutes ago", "Fetched 2 minutes ago"]);
  });
});
