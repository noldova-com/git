/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { signal, type WritableSignal } from "@angular/core";
import type { JsonValue } from "@noldova/context.json";
import { StatusBarItem, StatusBarItemContribution, StatusBarSide } from "@noldova/desktop.window";
import { FakeWindowPartContext } from "@noldova/desktop.window/testing";
import { FailureCode, GitCommand, GitCommandLog } from "@noldova/git.protocol";
import { describe, expect, it, onTestFinished, vi } from "vitest";

import { GitFolder } from "../../../src/app/services/git-folder.ts";
import { GitRuntimeClient } from "../../../src/app/services/git-runtime-client.ts";
import { GitStatusBar } from "../../../src/app/services/git-status-bar.ts";
import { GitStatusFollower } from "../../../src/app/services/git-status-follower.ts";
import { GitFixtures } from "../../fixtures/git-fixtures.fixture.ts";
import { GitHeldRequests } from "../../fixtures/git-held-requests.fixture.ts";

/** Two command log reads held open, the earlier one asked first, each answered when the test chooses. */
class LogReads {
  public readonly earlier: (answer: JsonValue | Error) => void;
  public readonly later: (answer: JsonValue | Error) => void;

  public constructor(earlier: (answer: JsonValue | Error) => void, later: (answer: JsonValue | Error) => void) {
    this.earlier = earlier;
    this.later = later;
  }
}

describe("GitStatusFollower", () => {
  const at: string = "2026-11-22T18:05:00Z";
  const logOf = (...lines: readonly string[]): JsonValue => new GitCommandLog(lines.map((t, i) => new GitCommand(String(i + 1), at, t, 0, 40))).toJson();
  const until = (done: () => boolean): Promise<boolean> => vi.waitUntil(done, { timeout: 5000 });
  const answers = { ...GitFixtures.watching, "git.status": GitFixtures.status().toJson() };

  /** The branch and command items, the folder Git shows, and a context that answers as `answers` says; following starts once `follow` runs. */
  interface ISetUp {
    readonly branch: StatusBarItem;
    readonly command: StatusBarItem;
    readonly context: FakeWindowPartContext;
    readonly shown: WritableSignal<string | null>;
    readonly follow: () => void;
  }

  function setUp(answer: Readonly<Record<string, JsonValue | Error | (() => JsonValue | Error)>>, folder: string | null = GitFixtures.folder): ISetUp {
    const itemOf = (name: string): StatusBarItem => new StatusBarItem(new StatusBarItemContribution(name, StatusBarSide.Left, GitStatusBar.stateOf(null, null)), () => undefined);
    const branch: StatusBarItem = itemOf("git.branch");
    const command: StatusBarItem = itemOf("git.lastCommand");
    onTestFinished(GitStatusBar.provide(branch, itemOf("git.fetched"), command));
    const context = new FakeWindowPartContext();
    context.answer("log", () => undefined);
    GitFixtures.answerWith(context, answer);
    const shown: WritableSignal<string | null> = signal(folder);
    onTestFinished(GitFolder.provide(context, shown));
    return { branch, command, context, shown, follow: (): void => onTestFinished(GitStatusFollower.follow(context)) };
  }

  const calls = (context: FakeWindowPartContext, method: string): number => context.callsOf("requestAsync").filter(t => t[0] === method).length;

  it("shows the branch and the last command of the folder Git shows with no view open, watching it, follows its changes, and lets it go without one", async () => {
    let fingerprint: number = 1;
    const { branch, command, context, shown, follow } = setUp({ ...answers, "git.status": () => GitFixtures.status([], null, { fingerprint: `f${fingerprint}` }).toJson(),
      "git.commandLog": () => fingerprint === 1 ? logOf("git add -- a.txt") : logOf("git add -- a.txt", "git fetch --quiet") });
    follow();
    await until(() => command.state().text === "git add -- a.txt");
    const first: readonly unknown[] = [branch.state().isHidden, calls(context, "git.watch")];

    fingerprint = 2;
    context.raiseEvent("git.changed", { folder: "/elsewhere" });
    context.raiseEvent("git.changed", { folder: GitFixtures.folder });
    await until(() => command.state().text === "git fetch --quiet");
    shown.set(null);
    await until(() => command.state().isHidden);

    expect([first, calls(context, "git.status"), branch.state().isHidden, calls(context, "git.unwatch")]).toEqual([[false, 1], 2, true, 1]);
  });

  it("keeps the later read over an earlier one still running, whether the earlier one answers or fails, and logs nothing for it", async () => {
    const { command, context, follow } = setUp({});
    const held: GitHeldRequests = new GitHeldRequests(context, ["git.commandLog"], answers);
    const reads = vi.spyOn(GitRuntimeClient.prototype, "commandLogAsync");
    onTestFinished(() => reads.mockRestore());
    const settledAsync = async (): Promise<void> => {
      await Promise.allSettled(reads.mock.results.flatMap(t => t.type === "return" ? [t.value] : []));
    };
    const pair = async (): Promise<LogReads> => {
      const earlier = await held.nextAsync("git.commandLog");
      context.raiseEvent("git.changed", { folder: GitFixtures.folder });
      return new LogReads(earlier, await held.nextAsync("git.commandLog"));
    };
    follow();
    const { earlier: first, later: second } = await pair();
    second(logOf("git fetch --quiet"));
    await until(() => command.state().text === "git fetch --quiet");
    first(logOf("git add -- a.txt"));
    await settledAsync();
    const answered: string = command.state().text;
    context.raiseEvent("git.changed", { folder: GitFixtures.folder });
    const { earlier: third, later: fourth } = await pair();
    fourth(logOf("git fetch --quiet", "git status"));
    await until(() => command.state().text === "git status");
    third(new Error("late read broke"));
    await settledAsync();

    expect([answered, command.state().text, context.callsOf("log")]).toEqual(["git fetch --quiet", "git status", []]);
  });

  it("hides the items for a read Git can't answer without a log, shows the next one's, and logs a failure outside Git", async () => {
    let fingerprint: number = 1;
    const logs: readonly (() => JsonValue | Error)[] = [() => logOf("git add -- a.txt"), () => GitFixtures.failure(FailureCode.Unavailable, null, "Git can't run."),
      () => logOf("git fetch --quiet"), () => new Error("log broke")];
    const { command, context, follow } = setUp({ ...answers, "git.commandLog": () => logs[fingerprint - 1]?.() ?? logOf() });
    const change = async (next: number, done: () => boolean): Promise<void> => {
      fingerprint = next;
      context.raiseEvent("git.changed", { folder: GitFixtures.folder });
      await until(done);
    };
    follow();
    await until(() => command.state().text === "git add -- a.txt");
    await change(2, () => command.state().isHidden);
    const hidden: readonly unknown[] = [...context.callsOf("log")];
    await change(3, () => command.state().text === "git fetch --quiet");
    await change(4, () => command.state().isHidden);

    expect([hidden, context.callsOf("log").map(t => String(t[0]))]).toEqual([[], [`The status bar couldn't read ${GitFixtures.folder}: Error: log broke`]]);
  });

  it("logs a folder it can't watch or stop watching, still showing its status", async () => {
    const { branch, context, shown, follow } = setUp({ ...answers, "git.watch": new Error("watch broke"), "git.unwatch": new Error("unwatch broke") });
    follow();
    await until(() => !branch.state().isHidden);
    shown.set("/work/other");
    await until(() => context.callsOf("log").length === 3);

    expect(context.callsOf("log").map(t => String(t[0]))).toEqual([
      `The status bar doesn't follow changes made outside the window in ${GitFixtures.folder}, since it couldn't be watched: Error: watch broke`,
      `The status bar couldn't stop watching ${GitFixtures.folder}: Error: unwatch broke`,
      "The status bar doesn't follow changes made outside the window in /work/other, since it couldn't be watched: Error: watch broke"]);
  });

  it("shows nothing and watches nothing while Git shows no folder, and stops following when it is stopped", async () => {
    const { branch, context, shown, follow } = setUp(answers, null);
    const stop = GitStatusFollower.follow(context);
    await Promise.resolve();
    const idle: readonly unknown[] = [branch.state().isHidden, context.callsOf("requestAsync").length];
    stop();
    shown.set(GitFixtures.folder);
    await Promise.resolve();
    follow();
    await until(() => !branch.state().isHidden);

    expect([idle, calls(context, "git.watch")]).toEqual([[true, 0], 1]);
  });
});
