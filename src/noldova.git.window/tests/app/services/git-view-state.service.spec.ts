/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { computed, ErrorHandler, signal, type WritableSignal } from "@angular/core";
import { TestBed } from "@angular/core/testing";
import { WindowPartTokens } from "@noldova/desktop.window";
import { FakeWindowPartContext } from "@noldova/desktop.window/testing";
import type { JsonValue } from "@noldova/context.json";
import { ConflictKind, DiffScopeKind, FailureCode, FileState, GitCode, type GitDiff, GitHooks, GitOperation, type GitStatus, LineKind, OperationKind } from "@noldova/git.protocol";
import { describe, expect, it, onTestFinished, vi } from "vitest";

import { GitViewPhase } from "../../../src/app/enums/git-view-phase.ts";
import { StatusMissingException } from "../../../src/app/exceptions/status-missing.exception.ts";
import { GitFolder } from "../../../src/app/services/git-folder.ts";
import { GitViewStateService } from "../../../src/app/services/git-view-state.service.ts";
import { GitFixtures } from "../../fixtures/git-fixtures.fixture.ts";
import { GitHeldRequests } from "../../fixtures/git-held-requests.fixture.ts";

describe("GitViewStateService", () => {
  const folder: string = GitFixtures.folder;

  const start = (context: FakeWindowPartContext): { readonly state: GitViewStateService; readonly chosen: WritableSignal<string | null> } => {
    const chosen: WritableSignal<string | null> = GitFixtures.setUp(context, [GitViewStateService]);
    const state: GitViewStateService = TestBed.inject(GitViewStateService);
    TestBed.tick();
    return { state, chosen };
  };

  const methods = (context: FakeWindowPartContext): readonly unknown[] => context.callsOf("requestAsync").map(t => t[0]);

  it("watches the folder, shows its status, and moves the watch when the folder changes or goes", async () => {
    const context: FakeWindowPartContext = new FakeWindowPartContext();
    GitFixtures.answerWith(context, { ...GitFixtures.watching, "git.status": GitFixtures.status().toJson() });
    const { state, chosen } = start(context);

    expect(state.phase()).toBe(GitViewPhase.Loading);
    await GitFixtures.untilAsync(() => state.phase() === GitViewPhase.Ready);
    chosen.set("/work/other");
    TestBed.tick();
    await GitFixtures.untilAsync(() => state.status() !== null);
    chosen.set(null);
    TestBed.tick();
    await GitFixtures.untilAsync(() => state.phase() === GitViewPhase.NoFolder);

    expect(state.status()).toBeNull();
    expect(context.callsOf("requestAsync").filter(t => t[0] !== "git.status")).toEqual([
      ["git.watch", { folder }],
      ["git.unwatch", { folder }],
      ["git.watch", { folder: "/work/other" }],
      ["git.unwatch", { folder: "/work/other" }]
    ]);
  });

  it("shows and logs a watch the runtime refuses, and logs an unwatch it refuses", async () => {
    const context: FakeWindowPartContext = new FakeWindowPartContext();
    GitFixtures.answerWith(context, { ...GitFixtures.watching, "git.watch": GitFixtures.lost("no watch"), "git.unwatch": GitFixtures.lost("no unwatch"), "git.status": GitFixtures.status().toJson() });
    const logged: Promise<void> = GitFixtures.loggedAsync(context, 2);
    const { state, chosen } = start(context);

    await GitFixtures.untilAsync(() => state.watchFailure() !== null && state.phase() === GitViewPhase.Ready);
    const shown: string | null = state.watchFailure();
    chosen.set(null);
    TestBed.tick();
    await logged;

    expect(shown).toBe("Changes made outside the Git view aren't followed, since the folder couldn't be watched: no watch");
    expect(context.callsOf("log")).toEqual([
      ["Changes made outside the Git view aren't followed, since the folder couldn't be watched: FailedRequest: no watch"],
      [`The Git view couldn't stop watching ${folder}: FailedRequest: no unwatch`]
    ]);
    expect(state.watchFailure()).toBeNull();
  });

  it("hands an unwatch that fails other than through Desktop to the error handler, and logs nothing", async () => {
    const context: FakeWindowPartContext = new FakeWindowPartContext();
    const broken: TypeError = new TypeError("broken unwatch");
    GitFixtures.answerWith(context, { ...GitFixtures.watching, "git.unwatch": broken, "git.status": GitFixtures.status().toJson() });
    const { state, chosen } = start(context);
    const handled: Promise<unknown> = new Promise(resolve => vi.spyOn(TestBed.inject(ErrorHandler), "handleError").mockImplementation(resolve));

    await GitFixtures.untilAsync(() => state.phase() === GitViewPhase.Ready);
    chosen.set(null);
    TestBed.tick();

    expect([await handled, context.callsOf("log")]).toEqual([broken, []]);
  });

  it("watches again and reads the status when asked to follow again, and clears the watch failure once the watch holds", async () => {
    const context: FakeWindowPartContext = new FakeWindowPartContext();
    let fails: boolean = true;
    GitFixtures.answerWith(context, { ...GitFixtures.watching, "git.watch": () => fails ? GitFixtures.lost("no watch") : null, "git.status": GitFixtures.status().toJson() });
    const { state } = start(context);
    await GitFixtures.untilAsync(() => state.watchFailure() !== null);
    fails = false;
    const reads: number = methods(context).filter(t => t === "git.status").length;

    await state.followAgainAsync();

    expect(state.watchFailure()).toBeNull();
    expect(methods(context).filter(t => t === "git.watch")).toEqual(["git.watch", "git.watch"]);
    expect(methods(context).filter(t => t === "git.status").length).toBe(reads + 1);
  });

  it("watches nothing when asked to follow again with no folder", async () => {
    const context: FakeWindowPartContext = new FakeWindowPartContext();
    GitFixtures.answerWith(context, { ...GitFixtures.watching, "git.status": GitFixtures.status().toJson() });
    const { state, chosen } = start(context);
    chosen.set(null);
    TestBed.tick();
    const before: readonly unknown[] = methods(context);

    await state.followAgainAsync();

    expect(methods(context)).toEqual(before);
  });

  it("drops a watch failure that comes back after the folder changed", async () => {
    const context: FakeWindowPartContext = new FakeWindowPartContext();
    const held: GitHeldRequests = new GitHeldRequests(context, ["git.watch"], { ...GitFixtures.watching, "git.status": GitFixtures.status().toJson() });
    const logged: Promise<void> = GitFixtures.loggedAsync(context, 1);
    const { state, chosen } = start(context);
    chosen.set("/work/other");
    TestBed.tick();
    await held.answerAsync("git.watch", GitFixtures.lost("late"));
    await held.answerAsync("git.watch", null);
    await logged;

    expect(context.callsOf("log")).toEqual([["Changes made outside the Git view aren't followed, since the folder couldn't be watched: FailedRequest: late"]]);
    expect(state.watchFailure()).toBeNull();
  });

  it("shows the app's folder failure, not No folder, while the folder provider throws, and the folder again once it reads", async () => {
    const context: FakeWindowPartContext = new FakeWindowPartContext();
    GitFixtures.answerWith(context, { ...GitFixtures.watching, "git.status": GitFixtures.status().toJson() });
    const broken: WritableSignal<boolean> = signal(false);
    onTestFinished(GitFolder.provide(context, computed((): string => {
      if (broken())
        throw new Error("No chat is shown.");
      return folder;
    })));
    TestBed.configureTestingModule({ providers: [{ provide: WindowPartTokens.context, useValue: context }, GitViewStateService] });
    const state: GitViewStateService = TestBed.inject(GitViewStateService);
    TestBed.tick();
    await GitFixtures.untilAsync(() => state.phase() === GitViewPhase.Ready);

    broken.set(true);
    TestBed.tick();
    await GitFixtures.untilAsync(() => state.phase() === GitViewPhase.FolderFailed);
    const failed: readonly [string, GitStatus | null] = [state.readFailure(), state.status()];
    broken.set(false);
    TestBed.tick();
    await GitFixtures.untilAsync(() => state.phase() === GitViewPhase.Ready);

    expect(failed).toEqual(["No chat is shown.", null]);
  });

  it("shows No folder, with no failure, when the app gives no folder", async () => {
    const context: FakeWindowPartContext = new FakeWindowPartContext();
    GitFixtures.answerWith(context, { ...GitFixtures.watching, "git.status": GitFixtures.status().toJson() });
    const { state, chosen } = start(context);
    await GitFixtures.untilAsync(() => state.phase() === GitViewPhase.Ready);
    chosen.set(null);
    TestBed.tick();

    await GitFixtures.untilAsync(() => state.phase() === GitViewPhase.NoFolder);
    expect(state.readFailure()).toBe("");
  });

  it("reads the status again when its folder changes on disk, and ignores another folder's change", async () => {
    const context: FakeWindowPartContext = new FakeWindowPartContext();
    GitFixtures.answerWith(context, { ...GitFixtures.watching, "git.status": GitFixtures.status().toJson() });
    const { state } = start(context);
    await GitFixtures.untilAsync(() => state.phase() === GitViewPhase.Ready);

    context.raiseEvent("git.changed", { folder: "/work/other" });
    context.raiseEvent("git.changed", { folder });

    expect(context.callsOf("requestAsync").filter(t => t[0] === "git.status")).toEqual([["git.status", { folder }], ["git.status", { folder }]]);
  });

  it("keeps only the latest read's answer when an earlier read answers after it", async () => {
    const context: FakeWindowPartContext = new FakeWindowPartContext();
    const held: GitHeldRequests = new GitHeldRequests(context, ["git.status"], GitFixtures.watching);
    const { state } = start(context);
    await held.answerAsync("git.status", GitFixtures.status([], null, { fingerprint: "opened" }).toJson());
    await GitFixtures.untilAsync(() => state.phase() === GitViewPhase.Ready);

    const early: Promise<void> = state.refreshAsync();
    const late: Promise<void> = state.refreshAsync();
    const [earlyAnswer, lateAnswer] = [await held.nextAsync("git.status"), await held.nextAsync("git.status")];
    lateAnswer(GitFixtures.status([], null, { fingerprint: "late" }).toJson());
    await late;
    const shown: string | undefined = state.status()?.fingerprint;
    earlyAnswer(GitFixtures.status([], null, { fingerprint: "early" }).toJson());
    await early;

    expect([shown, state.status()?.fingerprint]).toEqual(["late", "late"]);
  });

  it("ignores an earlier read's failure once a later read has answered", async () => {
    const context: FakeWindowPartContext = new FakeWindowPartContext();
    const held: GitHeldRequests = new GitHeldRequests(context, ["git.status"], GitFixtures.watching);
    const { state } = start(context);
    await held.answerAsync("git.status", GitFixtures.status([], null, { fingerprint: "opened" }).toJson());
    await GitFixtures.untilAsync(() => state.phase() === GitViewPhase.Ready);

    const early: Promise<void> = state.refreshAsync();
    const late: Promise<void> = state.refreshAsync();
    const [earlyAnswer, lateAnswer] = [await held.nextAsync("git.status"), await held.nextAsync("git.status")];
    lateAnswer(GitFixtures.status([], null, { fingerprint: "late" }).toJson());
    await late;
    earlyAnswer(GitFixtures.failure(FailureCode.Git, GitCode.IndexLocked, "The index is locked."));
    await early;

    expect([state.phase(), state.status()?.fingerprint, state.failure()]).toEqual([GitViewPhase.Ready, "late", null]);
  });

  it.each([
    [GitFixtures.failure(FailureCode.NotRepository), GitViewPhase.NotRepository],
    [GitFixtures.failure(FailureCode.Unavailable, GitCode.FolderUnreadable), GitViewPhase.FolderUnreadable],
    [GitFixtures.failure(FailureCode.Unavailable, GitCode.GitMissing), GitViewPhase.GitMissing],
    [GitFixtures.failure(FailureCode.Unavailable, GitCode.GitTooOld), GitViewPhase.GitTooOld],
    [GitFixtures.failure(FailureCode.Git, GitCode.UnsafeRepository, "Git refused."), GitViewPhase.Failed]
  ])("shows the phase a failed status read names", async (failure, phase) => {
    const context: FakeWindowPartContext = new FakeWindowPartContext();
    GitFixtures.answerWith(context, { ...GitFixtures.watching, "git.status": failure });
    const { state } = start(context);

    await GitFixtures.untilAsync(() => state.phase() === phase);
    expect([state.status(), state.failure()]).toEqual([null, "Git refused."]);
  });

  it("shows a request the window fails or an answer it can't read as a failure, and clears it once a read succeeds", async () => {
    const context: FakeWindowPartContext = new FakeWindowPartContext();
    let answer: JsonValue | Error = GitFixtures.lost("The runtime stopped.");
    GitFixtures.answerWith(context, { ...GitFixtures.watching, "git.status": () => answer });
    const { state } = start(context);
    await GitFixtures.untilAsync(() => state.failure() !== null);
    const lost: string | null = state.failure();

    answer = "lost";
    await state.refreshAsync();
    const unreadable: readonly [GitViewPhase, boolean] = [state.phase(), state.failure() !== null];
    answer = GitFixtures.status().toJson();
    await state.refreshAsync();

    expect([lost, unreadable]).toEqual(["The runtime stopped.", [GitViewPhase.Failed, true]]);
    expect([state.phase(), state.failure()]).toEqual([GitViewPhase.Ready, null]);
  });

  it("passes on an error that is neither the window's failure nor an unreadable answer, rather than showing it as git's", async () => {
    const context: FakeWindowPartContext = new FakeWindowPartContext();
    const bug = new TypeError("Not a function.");
    let broken: boolean = false;
    const answer = (value: JsonValue): (() => JsonValue | Error) => () => broken ? bug : value;
    GitFixtures.answerWith(context, {
      ...GitFixtures.watching,
      "git.status": answer(GitFixtures.status().toJson()), "git.watch": answer(null), "git.branches": answer(GitFixtures.branches("main", ["main"]).toJson()),
      "git.pullHooks": answer(new GitHooks([]).toJson()), "git.stage": answer(null)
    });
    const { state } = start(context);
    await GitFixtures.untilAsync(() => state.phase() === GitViewPhase.Ready);
    broken = true;

    const failures: readonly unknown[] = [
      await state.refreshAsync().then(() => null, (error: unknown) => error), await state.loadBranchesAsync().then(() => null, (error: unknown) => error),
      await state.loadPullHooksAsync().then(() => null, (error: unknown) => error), await state.followAgainAsync().then(() => null, (error: unknown) => error),
      await state.stageAsync(["a.ts"]).then(() => null, (error: unknown) => error)
    ];

    expect(failures).toEqual([bug, bug, bug, bug, bug]);
    expect([state.phase(), state.failure(), state.watchFailure(), state.busy(), context.callsOf("log")]).toEqual([GitViewPhase.Ready, null, null, false, []]);
  });

  it("sends each write with the status's fingerprint, then reads the status again", async () => {
    const context: FakeWindowPartContext = new FakeWindowPartContext();
    GitFixtures.answerWith(context, {
      ...GitFixtures.watching, "git.stage": null, "git.unstage": null, "git.switchBranch": null, "git.createBranch": null, "git.push": null, "git.pull": null,
      "git.status": GitFixtures.status([], null, { fingerprint: "f9" }).toJson()
    });
    const { state } = start(context);
    await GitFixtures.untilAsync(() => state.phase() === GitViewPhase.Ready);

    await state.stageAsync(["a.ts"]);
    await state.unstageAsync(["b.ts"]);
    await state.switchBranchAsync("main");
    await state.createBranchAsync("feature");
    await state.pushAsync();
    await state.pullAsync();

    expect(context.callsOf("requestAsync").filter(t => t[0] !== "git.status" && t[0] !== "git.watch")).toEqual([
      ["git.stage", { folder, paths: ["a.ts"], basedOn: "f9" }],
      ["git.unstage", { folder, paths: ["b.ts"], basedOn: "f9" }],
      ["git.switchBranch", { folder, name: "main", basedOn: "f9" }],
      ["git.createBranch", { folder, name: "feature", basedOn: "f9" }],
      ["git.push", { folder, basedOn: "f9" }],
      ["git.pull", { folder, basedOn: "f9" }]
    ]);
    expect(methods(context).filter(t => t === "git.status")).toHaveLength(7);
  });

  it("clears the message after a commit, keeps it when the status moved, and shows any other refusal", async () => {
    const context: FakeWindowPartContext = new FakeWindowPartContext();
    let commit: JsonValue | Error = null;
    GitFixtures.answerWith(context, { ...GitFixtures.watching, "git.status": GitFixtures.status().toJson(), "git.commit": () => commit });
    const { state } = start(context);
    await GitFixtures.untilAsync(() => state.phase() === GitViewPhase.Ready);

    state.message.set("Fix it");
    commit = GitFixtures.failure(FailureCode.Stale);
    await state.commitAsync("Fix it");
    const afterStale: readonly [string, string | null] = [state.message(), state.failure()];
    commit = GitFixtures.failure(FailureCode.Git, GitCode.HookFailed, "The hook refused.");
    await state.commitAsync("Fix it");
    const afterRefusal: readonly [string, string | null] = [state.message(), state.failure()];
    commit = GitFixtures.lost("The runtime stopped.");
    await state.commitAsync("Fix it");
    const afterError: string | null = state.failure();
    commit = null;
    await state.commitAsync("Fix it");

    expect([afterStale, afterRefusal, afterError, [state.message(), state.failure()]])
      .toEqual([["Fix it", null], ["Fix it", "The hook refused."], "The runtime stopped.", ["", null]]);
  });

  it("writes nothing without a status or while another write runs", async () => {
    const context: FakeWindowPartContext = new FakeWindowPartContext();
    let finish: () => void = () => undefined;
    const pending: Promise<JsonValue> = new Promise(resolve => finish = () => resolve(null));
    GitFixtures.answerWith(context, { ...GitFixtures.watching, "git.status": GitFixtures.failure(FailureCode.NotRepository) });
    const { state } = start(context);
    await GitFixtures.untilAsync(() => state.phase() === GitViewPhase.NotRepository);

    await state.pushAsync();
    GitFixtures.answerWith(context, { ...GitFixtures.watching, "git.status": GitFixtures.status().toJson() });
    await state.refreshAsync();
    context.answer("requestAsync", async method => method === "git.push" ? pending : GitFixtures.answerFor({ ...GitFixtures.watching, "git.status": GitFixtures.status().toJson() }, method));
    const first: Promise<void> = state.pushAsync();
    await state.pushAsync();
    finish();
    await first;

    expect(methods(context).filter(t => t === "git.push")).toHaveLength(1);
    expect(state.busy()).toBe(false);
  });

  it("loads the branches, and shows why it couldn't", async () => {
    const context: FakeWindowPartContext = new FakeWindowPartContext();
    let answer: JsonValue | Error = GitFixtures.branches("main", ["main", "dev"]).toJson();
    GitFixtures.answerWith(context, { ...GitFixtures.watching, "git.status": GitFixtures.status().toJson(), "git.branches": () => answer });
    const { state, chosen } = start(context);

    await state.loadBranchesAsync();
    const loaded: readonly string[] | undefined = state.branches()?.branches;
    answer = GitFixtures.failure(FailureCode.Git, GitCode.IndexLocked, "The index is locked.");
    await state.loadBranchesAsync();
    const refusal: string | null = state.failure();
    chosen.set(null);
    TestBed.tick();
    await state.loadBranchesAsync();

    expect([loaded, refusal]).toEqual([["main", "dev"], "The index is locked."]);
    expect(methods(context).filter(t => t === "git.branches")).toHaveLength(2);
  });

  it("drops a branch list, or the refusal to read one, that arrives after the folder changed, and a branch list a write superseded", async () => {
    const context: FakeWindowPartContext = new FakeWindowPartContext();
    const held: GitHeldRequests = new GitHeldRequests(context, ["git.branches", "git.push"], { ...GitFixtures.watching, "git.status": GitFixtures.status().toJson() });
    const { state, chosen } = start(context);
    await GitFixtures.untilAsync(() => state.phase() === GitViewPhase.Ready);

    const forOld: Promise<void> = state.loadBranchesAsync();
    chosen.set("/work/other");
    TestBed.tick();
    await held.answerAsync("git.branches", GitFixtures.branches("main", ["old"]).toJson());
    await forOld;
    const refusedForOld: Promise<void> = state.loadBranchesAsync();
    chosen.set(folder);
    TestBed.tick();
    await held.answerAsync("git.branches", GitFixtures.failure(FailureCode.Git, GitCode.IndexLocked, "The index is locked."));
    await refusedForOld;
    const afterSwitching: readonly unknown[] = [state.branches(), state.failure()];
    await GitFixtures.untilAsync(() => state.phase() === GitViewPhase.Ready);
    const superseded: Promise<void> = state.loadBranchesAsync();
    const push: Promise<void> = state.pushAsync();
    await held.answerAsync("git.push", null);
    await push;
    await held.answerAsync("git.branches", GitFixtures.branches("main", ["before the push"]).toJson());
    await superseded;

    expect(afterSwitching).toEqual([null, null]);
    expect(state.branches()).toBeNull();
  });

  it("reads the hooks a pull runs once per folder, logs why it couldn't, and drops an answer for a folder the view has left", async () => {
    const context: FakeWindowPartContext = new FakeWindowPartContext();
    const held: GitHeldRequests = new GitHeldRequests(context, ["git.pullHooks"], { ...GitFixtures.watching, "git.status": GitFixtures.status().toJson() });
    const { state, chosen } = start(context);
    await GitFixtures.untilAsync(() => state.phase() === GitViewPhase.Ready);

    const forOld: Promise<void> = state.loadPullHooksAsync();
    chosen.set("/work/other");
    TestBed.tick();
    await held.answerAsync("git.pullHooks", new GitHooks(["post-merge"]).toJson());
    await forOld;
    const dropped: readonly string[] | null = state.pullHooks();
    const refusedForOld: Promise<void> = state.loadPullHooksAsync();
    chosen.set(folder);
    TestBed.tick();
    await held.answerAsync("git.pullHooks", GitFixtures.lost("gone"));
    await refusedForOld;
    const logsAfterSwitching: readonly (readonly unknown[])[] = [...context.callsOf("log")];
    const loaded: Promise<void> = state.loadPullHooksAsync();
    await held.answerAsync("git.pullHooks", new GitHooks(["post-merge"]).toJson());
    await loaded;
    await state.loadPullHooksAsync();
    const shown: readonly string[] | null = state.pullHooks();
    chosen.set("/work/other");
    TestBed.tick();
    const failed: Promise<void> = state.loadPullHooksAsync();
    await held.answerAsync("git.pullHooks", GitFixtures.lost("unreadable"));
    await failed;
    chosen.set(null);
    TestBed.tick();
    await state.loadPullHooksAsync();

    expect([dropped, logsAfterSwitching, shown]).toEqual([null, [], ["post-merge"]]);
    expect(context.callsOf("log")).toEqual([["The Git view couldn't read the hooks a pull runs: unreadable"]]);
    expect(methods(context).filter(t => t === "git.pullHooks")).toHaveLength(4);
  });

  it("drops a write's refusal for a folder the view has left, clears the typed message on a folder change, and keeps the new folder's message after an old commit", async () => {
    const context: FakeWindowPartContext = new FakeWindowPartContext();
    const held: GitHeldRequests = new GitHeldRequests(context, ["git.push", "git.commit"], { ...GitFixtures.watching, "git.status": GitFixtures.status().toJson() });
    const { state, chosen } = start(context);
    await GitFixtures.untilAsync(() => state.phase() === GitViewPhase.Ready);

    const push: Promise<void> = state.pushAsync();
    chosen.set("/work/other");
    TestBed.tick();
    await held.answerAsync("git.push", GitFixtures.failure(FailureCode.Git, GitCode.PushRejected, "The remote refused the push."));
    await push;
    const failureAfterSwitch: string | null = state.failure();
    await GitFixtures.untilAsync(() => state.phase() === GitViewPhase.Ready);
    state.message.set("Fix the header");
    const commit: Promise<void> = state.commitAsync("Fix the header");
    chosen.set(folder);
    TestBed.tick();
    const messageAfterSwitch: string = state.message();
    state.message.set("Typed for this folder");
    await held.answerAsync("git.commit", null);
    await commit;

    expect([failureAfterSwitch, messageAfterSwitch, state.message()]).toEqual([null, "", "Typed for this folder"]);
  });

  it("reads each diff once per status and scope, again after a failed read, and refuses one without a status", async () => {
    const context: FakeWindowPartContext = new FakeWindowPartContext();
    let fails: boolean = true;
    GitFixtures.answerWith(context, {
      ...GitFixtures.watching,
      "git.status": GitFixtures.status().toJson(),
      "git.diff": () => fails ? GitFixtures.lost("no diff") : GitFixtures.diff("a.ts", [LineKind.Added, "x"]).toJson()
    });
    const { state } = start(context);

    await expect(state.diffAsync(DiffScopeKind.Worktree)).rejects.toThrow(StatusMissingException);
    await GitFixtures.untilAsync(() => state.phase() === GitViewPhase.Ready);
    await expect(state.diffAsync(DiffScopeKind.Worktree)).rejects.toThrow("no diff");
    fails = false;
    const worktree: Promise<GitDiff> = state.diffAsync(DiffScopeKind.Worktree);
    await worktree;
    const again: Promise<GitDiff> = state.diffAsync(DiffScopeKind.Worktree);

    expect(again).toBe(worktree);
    expect(methods(context).filter(t => t === "git.diff")).toHaveLength(2);
  });

  it("words an error by git's message, an error's message, or the value itself", () => {
    expect([
      GitViewStateService.messageOf(GitFixtures.failure(FailureCode.Git, null, "Git refused.")), GitViewStateService.messageOf(new Error("lost")),
      GitViewStateService.messageOf("gone")
    ]).toEqual(["Git refused.", "lost", "gone"]);
  });

  it("counts no files before the status is read, then the conflicted and staged files", async () => {
    const context: FakeWindowPartContext = new FakeWindowPartContext();
    const status = GitFixtures.status([
      GitFixtures.entry("a.ts", FileState.Unmodified, FileState.Unmodified, null, ConflictKind.BothModified),
      GitFixtures.entry("b.ts", FileState.Modified, FileState.Unmodified)
    ], null, { operation: new GitOperation(OperationKind.Merge, "main", null) });
    GitFixtures.answerWith(context, { ...GitFixtures.watching, "git.status": status.toJson() });
    const { state } = start(context);

    const before: readonly number[] = [state.conflicts(), state.staged()];
    await GitFixtures.untilAsync(() => state.status() !== null);

    expect([before, [state.conflicts(), state.staged()]]).toEqual([[0, 0], [1, 1]]);
  });
});
