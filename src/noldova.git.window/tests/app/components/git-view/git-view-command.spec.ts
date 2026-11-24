/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ErrorHandler } from "@angular/core";
import { StatusBarItem, StatusBarItemContribution, StatusBarItemState, StatusBarSide } from "@noldova/desktop.window";
import type { JsonValue } from "@noldova/context.json";
import { FailureCode, GitCommand, GitCommandLog } from "@noldova/git.protocol";
import { describe, expect, it, onTestFinished, vi } from "vitest";

import { GitStatusBar } from "../../../../src/app/services/git-status-bar.ts";
import { GitFixtures } from "../../../fixtures/git-fixtures.fixture.ts";
import { GitHeldRequests } from "../../../fixtures/git-held-requests.fixture.ts";
import { GitViewFixture } from "../../../fixtures/git-view.fixture.ts";

describe("GitViewComponent's last command", () => {
  const at: string = "2026-11-22T18:05:00Z";
  const logOf = (...lines: readonly string[]): JsonValue => new GitCommandLog(lines.map((t, i) => new GitCommand(String(i + 1), at, t, 0, 40))).toJson();
  const commandItem = (): StatusBarItem => {
    const itemOf = (name: string): StatusBarItem => new StatusBarItem(new StatusBarItemContribution(name, StatusBarSide.Left, new StatusBarItemState("Starting")), () => undefined);
    const item: StatusBarItem = itemOf("git.lastCommand");
    onTestFinished(GitStatusBar.provide(itemOf("git.branch"), itemOf("git.fetched"), item));
    return item;
  };
  const until = (done: () => boolean): Promise<boolean> => vi.waitUntil(done, { timeout: 5000 });

  it("shows the last command the repository's writes ran once its status is read, and hides it without a repository", async () => {
    const item: StatusBarItem = commandItem();
    const view: GitViewFixture = await GitViewFixture.renderAsync({
      ...GitFixtures.watching, "git.status": GitFixtures.status().toJson(), "git.branches": GitFixtures.branches("main", ["main"]).toJson(),
      "git.commandLog": logOf("git add -- a.txt", "git commit --quiet --cleanup=whitespace --message=Fix")
    });
    await until(() => item.state().text !== "Starting");
    const shown: string = item.state().text;

    view.folder.set(null);
    await until(() => item.state().isHidden);

    expect([shown, item.state().isHidden]).toEqual(["git commit --quiet --cleanup=whitespace --message=Fix", true]);
  });

  it("keeps the later read's command over an earlier one still running", async () => {
    const item: StatusBarItem = commandItem();
    let fingerprint: number = 1;
    const answers = {
      ...GitFixtures.watching, "git.status": () => GitFixtures.status([], null, { fingerprint: `f${fingerprint}` }).toJson(),
      "git.branches": GitFixtures.branches("main", ["main"]).toJson()
    };
    const view: GitViewFixture = await GitViewFixture.renderAsync({ ...answers, "git.commandLog": logOf() });
    await until(() => item.state().text === "Command log");
    const held: GitHeldRequests = new GitHeldRequests(view.context, ["git.commandLog"], answers);
    const changed = (): void => {
      fingerprint += 1;
      view.context.raiseEvent("git.changed", { folder: GitFixtures.folder });
    };

    changed();
    const first = await held.nextAsync("git.commandLog");
    changed();
    const second = await held.nextAsync("git.commandLog");
    second(logOf("git fetch --quiet"));
    await until(() => item.state().text === "git fetch --quiet");
    first(logOf("git add -- a.txt"));
    await Promise.resolve();

    expect(item.state().text).toBe("git fetch --quiet");
  });

  const answers = { ...GitFixtures.watching, "git.status": GitFixtures.status().toJson(), "git.branches": GitFixtures.branches("main", ["main"]).toJson() };

  it("passes over a read Git can't answer, keeping the item hidden without a report, and shows the next one's command", async () => {
    const item: StatusBarItem = commandItem();
    const handleError = vi.fn();
    let fingerprint: number = 1;
    const view: GitViewFixture = await GitViewFixture.renderAsync({
      ...answers, "git.status": () => GitFixtures.status([], null, { fingerprint: `f${fingerprint}` }).toJson(),
      "git.commandLog": () => fingerprint === 1 ? GitFixtures.failure(FailureCode.Unavailable, null, "Git can't run.") : logOf("git fetch --quiet")
    }, ".body", [{ provide: ErrorHandler, useValue: { handleError } }]);
    await until(() => view.context.callsOf("requestAsync").some(t => t[0] === "git.commandLog"));
    const before: boolean = item.state().isHidden;
    fingerprint = 2;
    view.context.raiseEvent("git.changed", { folder: GitFixtures.folder });
    await until(() => item.state().text === "git fetch --quiet");

    expect([before, handleError.mock.calls]).toEqual([true, []]);
  });

  it("reports a failure outside Git", async () => {
    commandItem();
    const handleError = vi.fn();
    await GitViewFixture.renderAsync({ ...answers, "git.commandLog": new Error("log broke") }, ".body", [{ provide: ErrorHandler, useValue: { handleError } }]);
    await until(() => handleError.mock.calls.length > 0);

    expect(handleError.mock.calls.map(t => String(t[0]))).toEqual(["Error: log broke"]);
  });
});
