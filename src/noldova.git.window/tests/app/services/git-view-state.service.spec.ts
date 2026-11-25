/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { computed, ErrorHandler, signal, type WritableSignal } from "@angular/core";
import { TestBed } from "@angular/core/testing";
import "@noldova/context.core";
import { WindowPartTokens } from "@noldova/desktop.window";
import { FakeWindowPartContext } from "@noldova/desktop.window/testing";
import type { JsonValue } from "@noldova/context.json";
import {
  ConflictKind, ConflictResolution, DiffScopeKind, FailureCode, FileState, GitCode, GitCommit, GitCommitDetail, GitCommitSigning, GitConflict, type GitDiff, GitHooks, GitJournal, GitJournalEntry, GitLog, GitMarkerCheck, GitOperation,
  type GitStatus, LineKind, OperationKind, SigningFormat, StatusUpstream, UndoMode
} from "@noldova/git.protocol";
import { describe, expect, it, onTestFinished, vi } from "vitest";

import { GitViewPhase } from "../../../src/app/enums/git-view-phase.ts";
import { StatusMissingException } from "../../../src/app/exceptions/status-missing.exception.ts";
import { GitForcePushOffer } from "../../../src/app/models/git-force-push-offer.ts";
import { GitCommitPrefixes } from "../../../src/app/services/git-commit-prefixes.ts";
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
    await GitFixtures.untilAsync(() => !Object.isNull(state.status()));
    chosen.set(null);
    TestBed.tick();
    await GitFixtures.untilAsync(() => state.phase() === GitViewPhase.NoFolder);

    expect(state.status()).toBeNull();
    expect(context.callsOf("requestAsync").filter(t => !["git.status", "git.commitSigning"].includes(String(t[0])))).toEqual([
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

    await GitFixtures.untilAsync(() => !Object.isNull(state.watchFailure()) && state.phase() === GitViewPhase.Ready);
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

  it("logs nothing and shows no watch failure for a folder that isn't a repository, and on the window's focus watches and reads it again until it is one", async () => {
    const context: FakeWindowPartContext = new FakeWindowPartContext();
    const outside: Readonly<Record<string, JsonValue | Error>> = { ...GitFixtures.watching, "git.watch": GitFixtures.failure(FailureCode.NotRepository), "git.status": GitFixtures.failure(FailureCode.NotRepository) };
    const held: GitHeldRequests = new GitHeldRequests(context, ["git.watch"], outside);
    const { state } = start(context);
    await held.answerAsync("git.watch", GitFixtures.failure(FailureCode.NotRepository));
    await GitFixtures.untilAsync(() => state.phase() === GitViewPhase.NotRepository);
    const quiet: readonly unknown[] = [state.watchFailure(), context.callsOf("log")];

    window.dispatchEvent(new Event("focus"));
    await held.answerAsync("git.watch", GitFixtures.failure(FailureCode.NotRepository));
    await GitFixtures.untilAsync(() => methods(context).filter(t => t === "git.status").length === 2);
    GitFixtures.answerWith(context, { ...GitFixtures.watching, "git.status": GitFixtures.status().toJson() });
    window.dispatchEvent(new Event("focus"));
    await GitFixtures.untilAsync(() => state.phase() === GitViewPhase.Ready);
    window.dispatchEvent(new Event("focus"));
    await GitFixtures.untilAsync(() => methods(context).filter(t => t === "git.commitSigning").length === 2);

    expect(quiet).toEqual([null, []]);
    expect([state.watchFailure(), context.callsOf("log"), methods(context).filter(t => t === "git.watch").length]).toEqual([null, [], 3]);
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
    await GitFixtures.untilAsync(() => !Object.isNull(state.watchFailure()));
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
    await GitFixtures.untilAsync(() => !Object.isNull(state.failure()));
    const lost: string | null = state.failure();

    answer = "lost";
    await state.refreshAsync();
    const unreadable: readonly [GitViewPhase, boolean] = [state.phase(), !Object.isNull(state.failure())];
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

  it("can't undo a discard without a folder or a discard kept in a checkpoint, and passes on a journal read that fails for another reason", async () => {
    const context: FakeWindowPartContext = new FakeWindowPartContext();
    const broken: Error = new Error("The runtime went away.");
    GitFixtures.answerWith(context, { ...GitFixtures.watching, "git.journal": broken, "git.status": GitFixtures.status([]).toJson() });
    const { state, chosen } = start(context);
    await GitFixtures.untilAsync(() => state.phase() === GitViewPhase.Ready);

    await state.undoDiscardAsync();
    const rejected: unknown = await state.canUndoDiscardAsync().catch((error: unknown) => error);
    chosen.set(null);

    expect([await state.canUndoDiscardAsync(), rejected, methods(context).filter(t => t === "git.undo")]).toEqual([false, broken, []]);
  });

  it("sends each write with the status's fingerprint, then reads the status again", async () => {
    const context: FakeWindowPartContext = new FakeWindowPartContext();
    GitFixtures.answerWith(context, {
      ...GitFixtures.watching, "git.stage": null, "git.unstage": null, "git.switchBranch": null, "git.createBranch": null, "git.push": null, "git.pull": null,
      "git.stageLines": null, "git.unstageLines": null, "git.discard": null, "git.journal": new GitJournal([]).toJson(), "git.status": GitFixtures.status([], null, { fingerprint: "f9" }).toJson()
    });
    const { state } = start(context);
    await GitFixtures.untilAsync(() => state.phase() === GitViewPhase.Ready);

    await state.stageAsync(["a.ts"]);
    await state.unstageAsync(["b.ts"]);
    await state.switchBranchAsync("main");
    await state.createBranchAsync("feature");
    await state.pushAsync();
    await state.pullAsync();
    await state.stageLinesAsync("a.ts", [1], false);
    await state.stageLinesAsync("b.ts", [2, 3], true);
    await state.discardAsync(["c.ts"]);

    expect(context.callsOf("requestAsync").filter(t => !["git.status", "git.watch", "git.commitSigning"].includes(String(t[0])))).toEqual([
      ["git.stage", { folder, paths: ["a.ts"], basedOn: "f9" }],
      ["git.unstage", { folder, paths: ["b.ts"], basedOn: "f9" }],
      ["git.switchBranch", { folder, name: "main", basedOn: "f9" }],
      ["git.createBranch", { folder, name: "feature", basedOn: "f9" }],
      ["git.push", { folder, basedOn: "f9" }],
      ["git.pull", { folder, basedOn: "f9" }],
      ["git.stageLines", { folder, path: "a.ts", lines: [1], basedOn: "f9" }],
      ["git.unstageLines", { folder, path: "b.ts", lines: [2, 3], basedOn: "f9" }],
      ["git.discard", { folder, paths: ["c.ts"], basedOn: "f9" }],
      ["git.journal", { folder }]
    ]);
    expect(methods(context).filter(t => t === "git.status")).toHaveLength(10);
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

  it("reads how commits are signed with each status read and on window focus, keeps the last answer while a read runs, shows only the newest read's answer, logs why it couldn't, and reads nothing without a folder", async () => {
    const context: FakeWindowPartContext = new FakeWindowPartContext();
    const held: GitHeldRequests = new GitHeldRequests(context, ["git.commitSigning"], { ...GitFixtures.watching, "git.status": GitFixtures.status().toJson() });
    const { state, chosen } = start(context);
    const ssh: GitCommitSigning = new GitCommitSigning(true, SigningFormat.Ssh);
    const off: GitCommitSigning = new GitCommitSigning(false, SigningFormat.OpenPgp);
    await GitFixtures.untilAsync(() => state.phase() === GitViewPhase.Ready);
    const beforeAnswer: GitCommitSigning | null = state.commitSigning();
    await held.answerAsync("git.commitSigning", ssh.toJson());
    await GitFixtures.untilAsync(() => !Object.isNull(state.commitSigning()));
    const first: GitCommitSigning | null = state.commitSigning();

    const refreshed: Promise<void> = state.refreshAsync();
    await refreshed;
    const whileReading: GitCommitSigning | null = state.commitSigning();
    await held.answerAsync("git.commitSigning", off.toJson());
    await GitFixtures.untilAsync(() => state.commitSigning()?.signs === false);

    window.dispatchEvent(new Event("focus"));
    await held.answerAsync("git.commitSigning", GitFixtures.lost("unreadable"));
    await GitFixtures.loggedAsync(context, 1);
    const afterFailure: GitCommitSigning | null = state.commitSigning();

    const older: Promise<void> = state.loadSigningAsync();
    const newer: Promise<void> = state.loadSigningAsync();
    await held.answerAsync("git.commitSigning", ssh.toJson());
    await older;
    const afterOlder: GitCommitSigning | null = state.commitSigning();
    await held.answerAsync("git.commitSigning", ssh.toJson());
    await newer;
    const afterNewer: GitCommitSigning | null = state.commitSigning();

    chosen.set(null);
    TestBed.tick();
    const reads: number = methods(context).filter(t => t === "git.commitSigning").length;
    await state.loadSigningAsync();

    expect([beforeAnswer, first, whileReading, afterFailure, afterOlder, afterNewer, state.commitSigning()]).toEqual([null, ssh, ssh, off, off, ssh, null]);
    expect(context.callsOf("log")).toEqual([["The Git view couldn't read how commits are signed: unreadable"]]);
    expect([reads, methods(context).filter(t => t === "git.commitSigning").length]).toEqual([5, 5]);
  });

  it("rethrows a failure of the signing read that isn't the runtime's", async () => {
    const context: FakeWindowPartContext = new FakeWindowPartContext();
    const broken: Error = new Error("broken");
    const off: GitCommitSigning = new GitCommitSigning(false, SigningFormat.OpenPgp);
    let breaking: boolean = false;
    GitFixtures.answerWith(context, { ...GitFixtures.watching, "git.status": GitFixtures.status().toJson(), "git.commitSigning": () => breaking ? broken : off.toJson() });
    const { state } = start(context);
    await GitFixtures.untilAsync(() => !Object.isNull(state.commitSigning()));
    breaking = true;

    await expect(state.loadSigningAsync()).rejects.toBe(broken);
    expect(state.commitSigning()).toEqual(off);
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
    const commit: Promise<boolean> = state.commitAsync("Fix the header");
    chosen.set(folder);
    TestBed.tick();
    const messageAfterSwitch: string = state.message();
    state.message.set("Typed for this folder");
    await held.answerAsync("git.commit", null);
    await commit;

    expect([failureAfterSwitch, messageAfterSwitch, state.message()]).toEqual([null, "", "Typed for this folder"]);
  });

  it("reads the folder's leftover conflict markers and refuses the read without a folder", async () => {
    const context: FakeWindowPartContext = new FakeWindowPartContext();
    GitFixtures.answerWith(context, { ...GitFixtures.watching, "git.markerCheck": new GitMarkerCheck(["a.ts"]).toJson(), "git.status": GitFixtures.status([]).toJson() });
    const { state, chosen } = start(context);

    chosen.set(null);
    await expect(state.markerCheckAsync()).rejects.toThrow(StatusMissingException);
    chosen.set(folder);
    await GitFixtures.untilAsync(() => state.phase() === GitViewPhase.Ready);

    expect(await state.markerCheckAsync()).toEqual(new GitMarkerCheck(["a.ts"]));
  });

  it("reads a conflict of the folder, refuses one without a folder, and sends a resolution, a continue and an abort with the status's fingerprint", async () => {
    const context: FakeWindowPartContext = new FakeWindowPartContext();
    const conflict: GitConflict = new GitConflict("a.ts", ConflictKind.BothModified, OperationKind.Merge, "b\n", "o\n", "t\n", "m\n", "main", "feature", null, null, false, false);
    GitFixtures.answerWith(context, {
      ...GitFixtures.watching, "git.conflict": conflict.toJson(), "git.resolveConflict": null, "git.continueOperation": null, "git.abortOperation": null,
      "git.status": GitFixtures.status([], null, { fingerprint: "f9" }).toJson()
    });
    const { state, chosen } = start(context);

    chosen.set(null);
    await expect(state.conflictAsync("a.ts")).rejects.toThrow(StatusMissingException);
    chosen.set(folder);
    await GitFixtures.untilAsync(() => state.phase() === GitViewPhase.Ready);
    expect(await state.conflictAsync("a.ts")).toEqual(conflict);
    await state.resolveConflictAsync("a.ts", ConflictResolution.Text, "r\n");
    await state.continueOperationAsync();
    await state.abortOperationAsync();

    expect(context.callsOf("requestAsync").filter(t => !["git.status", "git.watch", "git.unwatch", "git.commitSigning"].includes(String(t[0])))).toEqual([
      ["git.conflict", { folder, path: "a.ts" }],
      ["git.resolveConflict", { folder, path: "a.ts", resolution: "Text", text: "r\n", basedOn: "f9" }],
      ["git.continueOperation", { folder, basedOn: "f9" }],
      ["git.abortOperation", { folder, basedOn: "f9" }]
    ]);
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

  it("switches nothing without a folder, and turns amending on without reading while there is no last commit", async () => {
    const context: FakeWindowPartContext = new FakeWindowPartContext();
    GitFixtures.answerWith(context, { ...GitFixtures.watching, "git.status": GitFixtures.failure(FailureCode.NotRepository) });
    const { state, chosen } = start(context);
    await GitFixtures.untilAsync(() => state.phase() === GitViewPhase.NotRepository);

    await state.setAmendingAsync(true);
    chosen.set(null);
    TestBed.tick();
    await state.switchBranchAsync("main");

    expect([state.amending(), methods(context).filter(t => t === "git.log" || t === "git.switchBranch")]).toEqual([true, []]);
  });

  it("fills an empty message from the last commit's subject alone, keeps a message typed or amending turned off meanwhile, keeps it when Git refuses the read, and reports a read failing outside Git", async () => {
    const context: FakeWindowPartContext = new FakeWindowPartContext();
    const held: GitHeldRequests = new GitHeldRequests(context, ["git.log"], {
      ...GitFixtures.watching, "git.status": GitFixtures.status().toJson(),
      "git.commitDetail": new GitCommitDetail("0123456789abcdef0123456789abcdef01234567", "", "A Person", "a@example.com", "2026-11-20T14:02:00Z", false).toJson()
    });
    const { state } = start(context);
    await GitFixtures.untilAsync(() => !Object.isNull(state.status()));
    const handled: WritableSignal<string[]> = signal<string[]>([]);
    vi.spyOn(TestBed.inject(ErrorHandler), "handleError").mockImplementation(error => handled.update(t => [...t, String(error)]));
    const log: JsonValue = new GitLog([new GitCommit("0123456789abcdef0123456789abcdef01234567", [], "A Person", "2026-11-20T14:02:00Z", "Start")], false).toJson();

    const empty: Promise<void> = state.setAmendingAsync(true);
    await held.answerAsync("git.log", new GitLog([], false).toJson());
    await empty;
    const fromEmptyLog: string = state.message();
    const typed: Promise<void> = state.setAmendingAsync(true);
    state.message.set("Typed");
    await held.answerAsync("git.log", log);
    await typed;
    const keptTyped: string = state.message();
    const off: Promise<void> = state.setAmendingAsync(true);
    state.amending.set(false);
    state.message.set("");
    await held.answerAsync("git.log", log);
    await off;
    const keptOff: string = state.message();
    const refused: Promise<void> = state.setAmendingAsync(true);
    await held.answerAsync("git.log", GitFixtures.failure(FailureCode.Git));
    await refused;
    const broken: Promise<void> = state.setAmendingAsync(true);
    await held.answerAsync("git.log", new Error("log broke"));
    await broken;

    expect([fromEmptyLog, keptTyped, keptOff, state.message(), handled()]).toEqual(["", "Typed", "", "", ["Error: log broke"]]);
  });

  it("starts an empty message with a host's prefix for the branch, swaps an untouched prefix when the branch changes, and keeps typed text", async () => {
    const context: FakeWindowPartContext = new FakeWindowPartContext();
    let branch: string | null = "feature/7521";
    GitFixtures.answerWith(context, { ...GitFixtures.watching, "git.status": () => GitFixtures.status([], null, { branch }).toJson() });
    onTestFinished(GitCommitPrefixes.provide(context, { prefixFor: (_folder, name) => name === "main" ? null : `AB#${name.slice(8)} ` }));
    const { state } = start(context);
    const nextAsync = async (name: string | null): Promise<string> => {
      branch = name;
      await state.refreshAsync();
      TestBed.tick();
      return state.message();
    };
    await GitFixtures.untilAsync(() => !Object.isNull(state.status()));
    TestBed.tick();

    const filled: string = state.message();
    const swapped: string = await nextAsync("feature/7530");
    const emptied: string = await nextAsync("main");
    const refilled: string = await nextAsync("feature/7521");
    const detached: string = await nextAsync(null);
    state.message.set("Typed");
    const kept: string = await nextAsync("feature/7530");

    expect([filled, swapped, emptied, refilled, detached, kept]).toEqual(["AB#7521 ", "AB#7530 ", "", "AB#7521 ", "", "Typed"]);
  });

  it("leaves a cleared message empty until a commit or amending turned off fills it again, and amends over an untouched prefix while keeping it through a branch change", async () => {
    const context: FakeWindowPartContext = new FakeWindowPartContext();
    let branch: string = "first";
    GitFixtures.answerWith(context, {
      ...GitFixtures.watching, "git.status": () => GitFixtures.status([], null, { branch }).toJson(), "git.commit": null,
      "git.log": new GitLog([new GitCommit("0123456789abcdef0123456789abcdef01234567", [], "A Person", "2026-11-20T14:02:00Z", "Start")], false).toJson(),
      "git.commitDetail": new GitCommitDetail("0123456789abcdef0123456789abcdef01234567", "", "A Person", "a@example.com", "2026-11-20T14:02:00Z", false).toJson()
    });
    onTestFinished(GitCommitPrefixes.provide(context, { prefixFor: (_folder, name) => `${name}: ` }));
    const { state } = start(context);
    await GitFixtures.untilAsync(() => !Object.isNull(state.status()));
    TestBed.tick();

    state.message.set("");
    TestBed.tick();
    const cleared: string = state.message();
    await state.commitAsync("Fix it");
    const committed: string = state.message();
    await state.setAmendingAsync(true);
    const amended: string = state.message();
    branch = "second";
    await state.refreshAsync();
    TestBed.tick();
    const keptAmending: string = state.message();
    await state.setAmendingAsync(false);

    expect([cleared, committed, amended, keptAmending, state.message()]).toEqual(["", "first: ", "Start", "Start", "second: "]);
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
    await GitFixtures.untilAsync(() => !Object.isNull(state.status()));

    expect([before, [state.conflicts(), state.staged()]]).toEqual([[0, 0], [1, 1]]);
  });

  it("offers a force push over the upstream's commit after a push refused as behind, sends it with that commit, and drops the offer on the next write", async () => {
    const context: FakeWindowPartContext = new FakeWindowPartContext();
    const id: string = "89abcdef0123456789abcdef0123456789abcdef";
    const behind: Error = GitFixtures.failure(FailureCode.Git, GitCode.PushBehind, "The branch is behind its upstream.");
    let push: JsonValue | Error = behind;
    GitFixtures.answerWith(context, {
      ...GitFixtures.watching, "git.push": () => push, "git.forcePush": null,
      "git.status": GitFixtures.status([], new StatusUpstream("origin/main", 1, 2, false, id), { fingerprint: "f9" }).toJson()
    });
    const { state } = start(context);
    await GitFixtures.untilAsync(() => state.phase() === GitViewPhase.Ready);

    await state.pushAsync();
    const offered: readonly [GitForcePushOffer | null, string | null, boolean] = [state.forcePushOffer(), state.failure(), state.fetchOffered()];
    push = GitFixtures.failure(FailureCode.Git, GitCode.PushRejected, "The remote refused the push.");
    await state.pushAsync();
    const rejected: GitForcePushOffer | null = state.forcePushOffer();
    push = GitFixtures.lost("The runtime stopped.");
    await state.pushAsync();
    const lost: GitForcePushOffer | null = state.forcePushOffer();
    push = behind;
    await state.pushAsync();
    await state.forcePushAsync(new GitForcePushOffer("main", "origin/main", id));

    expect([offered, rejected, lost, state.forcePushOffer()])
      .toEqual([[new GitForcePushOffer("main", "origin/main", id), "The branch is behind its upstream.", false], null, null, null]);
    expect(context.callsOf("requestAsync").filter(t => t[0] === "git.forcePush")).toEqual([["git.forcePush", { folder, expected: id, basedOn: "f9" }]]);
  });

  it("offers a fetch, never a force push, when the remote refused a push for commits the last fetch hadn't seen, and drops it on the next write or folder", async () => {
    const context: FakeWindowPartContext = new FakeWindowPartContext();
    GitFixtures.answerWith(context, {
      ...GitFixtures.watching, "git.fetch": null, "git.push": GitFixtures.failure(FailureCode.Git, GitCode.PushBehind, "The remote has commits this branch doesn't."),
      "git.status": GitFixtures.status([], new StatusUpstream("origin/main", 1, 0, false, "89abcdef0123456789abcdef0123456789abcdef"), { fingerprint: "f9" }).toJson()
    });
    const { state, chosen } = start(context);
    await GitFixtures.untilAsync(() => state.phase() === GitViewPhase.Ready);

    await state.pushAsync();
    const offered: readonly [boolean, GitForcePushOffer | null] = [state.fetchOffered(), state.forcePushOffer()];
    await state.fetchAsync();
    const fetched: boolean = state.fetchOffered();
    await state.pushAsync();
    chosen.set("/work/other");
    TestBed.tick();

    expect([offered, fetched, state.fetchOffered()]).toEqual([[true, null], false, false]);
    expect(context.callsOf("requestAsync").filter(t => t[0] === "git.fetch")).toEqual([["git.fetch", { folder, basedOn: "f9" }]]);
  });

  it("offers no force push for a refusal that arrives after the view left the folder, and drops an offer on another folder", async () => {
    const context: FakeWindowPartContext = new FakeWindowPartContext();
    const upstream: StatusUpstream = new StatusUpstream("origin/main", 1, 2, false, "89abcdef0123456789abcdef0123456789abcdef");
    const held: GitHeldRequests = new GitHeldRequests(context, ["git.push"], { ...GitFixtures.watching, "git.status": GitFixtures.status([], upstream).toJson() });
    const behind: Error = GitFixtures.failure(FailureCode.Git, GitCode.PushBehind, "The branch is behind its upstream.");
    const { state, chosen } = start(context);
    await GitFixtures.untilAsync(() => state.phase() === GitViewPhase.Ready);

    const left: Promise<void> = state.pushAsync();
    chosen.set("/work/other");
    TestBed.tick();
    await held.answerAsync("git.push", behind);
    await left;
    const afterLeaving: GitForcePushOffer | null = state.forcePushOffer();
    await GitFixtures.untilAsync(() => state.phase() === GitViewPhase.Ready);
    const push: Promise<void> = state.pushAsync();
    await held.answerAsync("git.push", behind);
    await push;
    const offered: boolean = !Object.isNull(state.forcePushOffer());
    chosen.set(folder);
    TestBed.tick();

    expect([afterLeaving, offered, state.forcePushOffer()]).toEqual([null, true, null]);
  });

  it("lists every write the journal keeps newest first, keeps the list when the journal can't be read, drops it for another folder, and undoes one by its id", async () => {
    const context: FakeWindowPartContext = new FakeWindowPartContext();
    const tree: string = "0123456789abcdef0123456789abcdef01234567";
    const entryOf = (id: string): GitJournalEntry => new GitJournalEntry(id, "git.stage", "2026-11-22T20:15:00Z", "main", "main", [], UndoMode.Index, tree, tree);
    const entries: readonly GitJournalEntry[] = Array.from({ length: 22 }, (_, index) => entryOf(String(index + 1)));
    let journal: JsonValue | Error = new GitJournal(entries).toJson();
    GitFixtures.answerWith(context, { ...GitFixtures.watching, "git.journal": () => journal, "git.undo": null, "git.status": GitFixtures.status([], null, { fingerprint: "f9" }).toJson() });
    const { state, chosen } = start(context);
    await GitFixtures.untilAsync(() => state.phase() === GitViewPhase.Ready);

    await state.readRecentActionsAsync();
    const listed: readonly string[] = state.recentActions().map(t => t.id);
    journal = GitFixtures.failure(FailureCode.Unavailable);
    await state.readRecentActionsAsync();
    const kept: number = state.recentActions().length;
    await state.undoEntryAsync(entryOf("5"));
    chosen.set("/work/other");
    TestBed.tick();
    const dropped: number = state.recentActions().length;
    chosen.set(null);
    TestBed.tick();
    await state.readRecentActionsAsync();

    expect(listed).toEqual(["22", "21", "20", "19", "18", "17", "16", "15", "14", "13", "12", "11", "10", "9", "8", "7", "6", "5", "4", "3", "2", "1"]);
    expect([kept, dropped, state.recentActions()]).toEqual([22, 0, []]);
    expect(context.callsOf("requestAsync").filter(t => t[0] === "git.undo")).toEqual([["git.undo", { folder, id: "5", basedOn: "f9" }]]);
    expect(methods(context).filter(t => t === "git.journal")).toHaveLength(2);
  });

  it("drops a list of recent actions that arrives after the view left the folder", async () => {
    const context: FakeWindowPartContext = new FakeWindowPartContext();
    const entry: GitJournalEntry = new GitJournalEntry("1", "git.push", "2026-11-22T20:15:00Z", "main", "main", [], UndoMode.None, null, null, null, []);
    const held: GitHeldRequests = new GitHeldRequests(context, ["git.journal"], { ...GitFixtures.watching, "git.status": GitFixtures.status().toJson() });
    const { state, chosen } = start(context);
    await GitFixtures.untilAsync(() => state.phase() === GitViewPhase.Ready);

    const read: Promise<void> = state.readRecentActionsAsync();
    chosen.set("/work/other");
    TestBed.tick();
    await held.answerAsync("git.journal", new GitJournal([entry]).toJson());
    await read;

    expect(state.recentActions()).toEqual([]);
  });
});
