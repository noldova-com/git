/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { computed, ErrorHandler } from "@angular/core";
import { type ComponentFixture, TestBed } from "@angular/core/testing";
import "@noldova/context.core";
import { WindowPartTokens } from "@noldova/desktop.window";
import { FakeWindowPartContext } from "@noldova/desktop.window/testing";
import type { JsonValue } from "@noldova/context.json";
import {
  ConflictKind, FailureCode, FileState, GitCode, GitJournal, GitJournalEntry, GitOperation, GitRemote, type GitStatus, OperationKind, RemoteTransport, StatusUpstream, UndoMode
} from "@noldova/git.protocol";
import { describe, expect, it, onTestFinished, vi } from "vitest";
import { userEvent } from "vitest/browser";

import { GitViewComponent } from "../../../../src/app/components/git-view/git-view.component.ts";
import { GitViewPhase } from "../../../../src/app/enums/git-view-phase.ts";
import { GitFolder } from "../../../../src/app/services/git-folder.ts";
import { GitResolving } from "../../../../src/app/services/git-resolving.ts";
import { GitViewOptions } from "../../../../src/app/services/git-view-options.ts";
import { GitFixtures } from "../../../fixtures/git-fixtures.fixture.ts";
import { GitHeldRequests } from "../../../fixtures/git-held-requests.fixture.ts";
import { GitViewFixture } from "../../../fixtures/git-view.fixture.ts";
import { UnhandledRejections } from "../../../fixtures/unhandled-rejections.fixture.ts";
import { WindowFailure } from "../../../fixtures/window-failure.fixture.ts";
import { Wait } from "../../../fixtures/wait.fixture.ts";

describe("GitViewComponent", () => {
  it("says there is no folder until the app gives one", async () => {
    const view: GitViewFixture = await GitViewFixture.renderAsync({ ...GitFixtures.watching, "git.status": GitFixtures.status().toJson() });
    view.folder.set(null);
    await view.waitForAsync(".empty");

    expect(view.texts(".empty-icon, .heading, .text")).toEqual(["folder_off", "No folder", "Open a folder to see its Git state."]);
    expect(view.all(".actions")).toHaveLength(0);
  });

  it("shows the kit's spinner while a folder's first status read runs, hidden for the kit's delay so a fast read never flashes it, then the changes in its place", async () => {
    const answers: Readonly<Record<string, JsonValue>> = { ...GitFixtures.watching, "git.status": GitFixtures.status().toJson() };
    const view: GitViewFixture = await GitViewFixture.renderAsync(answers);
    const held: GitHeldRequests = new GitHeldRequests(view.context, ["git.status"], answers);

    view.folder.set("/work/other");
    await view.waitForAsync(".loading > nol-spinner");
    const spinner: HTMLElement = view.find(".loading > nol-spinner");
    const pending: boolean = spinner.classList.contains("nol-reveal-pending");
    await view.untilAsync(() => !spinner.classList.contains("nol-reveal-pending"));
    const shown: readonly unknown[] = [spinner.getAttribute("role"), (spinner.textContent ?? "").trim(), view.state.phase()];
    await held.answerAsync("git.status", answers["git.status"] ?? null);
    await view.waitForAsync("nol-git-commit-card");

    expect([pending, shown, view.all(".loading > nol-spinner").length]).toEqual([true, ["status", "Reading the repository", GitViewPhase.Loading], 0]);
  });

  it("says the app's folder couldn't be read, with the provider's failure and no action", async () => {
    const context: FakeWindowPartContext = new FakeWindowPartContext();
    onTestFinished(GitFolder.provide(context, computed((): string => {
      throw new Error("No chat is shown.");
    })));
    TestBed.configureTestingModule({ providers: [{ provide: WindowPartTokens.context, useValue: context }] });
    const fixture: ComponentFixture<GitViewComponent> = TestBed.createComponent(GitViewComponent);
    fixture.autoDetectChanges();
    const element: HTMLElement = fixture.nativeElement;
    await fixture.whenStable();

    expect([...element.querySelectorAll(".empty-icon, .heading, .text")].map(t => (t.textContent ?? "").trim()))
      .toEqual(["error", "The app's folder couldn't be read", "No chat is shown."]);
    expect([element.querySelectorAll(".actions").length, context.callsOf("requestAsync")]).toEqual([0, []]);
  });

  it("says the folder isn't a repository in its heading alone, the History page saying the rest", async () => {
    const view: GitViewFixture = await GitViewFixture.renderAsync({ ...GitFixtures.watching, "git.status": GitFixtures.failure(FailureCode.NotRepository) }, ".empty");

    expect(view.texts(".heading, .text")).toEqual(["Not a Git repository"]);
  });

  it("says the folder can't be read, naming it, and offers no Git", async () => {
    const view: GitViewFixture = await GitViewFixture.renderAsync({ ...GitFixtures.watching, "git.status": GitFixtures.failure(FailureCode.Unavailable, GitCode.FolderUnreadable) }, ".empty");

    expect(view.texts(".empty-icon, .heading, .text"))
      .toEqual(["lock", "Can't read this folder", "Your account doesn't have permission to open this folder, /work/project."]);
    expect(view.element.querySelectorAll(".actions").length).toBe(0);
  });

  it.each([
    [GitCode.GitMissing, "error", "Git isn't installed", "The Git view uses the Git on your computer. Install Git 2.39 or newer, then select Check again."],
    [GitCode.GitTooOld, "warning", "Your Git is too old", "The Git view needs Git 2.39 or newer. Update the Git on your computer, then select Check again."]
  ])("offers Git and a new check when %s", async (code, icon, heading, text) => {
    let answer: JsonValue | Error = GitFixtures.failure(FailureCode.Unavailable, code);
    const view: GitViewFixture = await GitViewFixture.renderAsync({ ...GitFixtures.watching, "git.status": () => answer }, ".empty");

    view.context.answer("openLinkAsync", async () => undefined);
    const shown: readonly string[] = view.texts(".empty-icon, .heading, .text, .actions .nol-button-label");
    await view.clickAsync(".actions button:first-child");
    answer = GitFixtures.status().toJson();
    await view.clickAsync(".actions button:last-child");
    await view.waitForAsync(".body");

    expect(shown).toEqual([icon, heading, text, "Get Git", "Check again"]);
    expect(view.context.callsOf("openLinkAsync")).toEqual([["https://git-scm.com/downloads"]]);
  });

  it("logs a Get Git page that couldn't be opened and says so under the buttons until Get Git is pressed again, and leaves any other failure unhandled", async () => {
    const view: GitViewFixture = await GitViewFixture.renderAsync({ ...GitFixtures.watching, "git.status": GitFixtures.failure(FailureCode.Unavailable, GitCode.GitMissing) }, ".empty");
    const broken: TypeError = new TypeError("broken");
    let failure: Error = new WindowFailure("No browser.");
    view.context.answer("openLinkAsync", async () => {
      throw failure;
    });

    await view.clickAsync(".actions button:first-child");
    await view.waitForAsync(".link-failed");
    const shown: readonly string[] = view.texts(".link-failed > *");
    view.context.answer("openLinkAsync", async () => undefined);
    await view.clickAsync(".actions button:first-child");
    await view.untilAsync(() => view.all(".link-failed").length === 0);
    failure = broken;
    view.context.answer("openLinkAsync", async () => {
      throw failure;
    });
    const rejection: Promise<unknown> = UnhandledRejections.nextAsync();
    await view.clickAsync(".actions button:first-child");

    expect(shown).toEqual(["error", "The page couldn't be opened; the app's log has the details."]);
    expect([await rejection, view.context.callsOf("log"), view.all(".link-failed").length])
      .toEqual([broken, [["The Git view couldn't open https://git-scm.com/downloads: WindowFailure: No browser."]], 0]);
  });

  it("names the version of a Git that is too old", async () => {
    const view: GitViewFixture = await GitViewFixture.renderAsync({ ...GitFixtures.watching, "git.status": GitFixtures.failure(FailureCode.Unavailable, GitCode.GitTooOld, "Git is too old.", "2.34.1") }, ".empty");

    expect(view.texts(".heading")).toEqual(["Git 2.34.1 is too old"]);
  });

  it("shows any other failure's message", async () => {
    const view: GitViewFixture = await GitViewFixture.renderAsync({ ...GitFixtures.watching, "git.status": GitFixtures.failure(FailureCode.Git, GitCode.UnsafeRepository, "The folder is owned by another user.") },
      ".empty");

    expect(view.texts(".heading, .text")).toEqual(["Git couldn't read this folder", "The folder is owned by another user."]);
  });

  it("shows the branch, the remote, the merge in progress, the file groups and the commit card, in that order", async () => {
    const status = GitFixtures.status([
      GitFixtures.entry("a.ts", FileState.Unmodified, FileState.Unmodified, null, ConflictKind.BothModified),
      GitFixtures.entry("b.ts", FileState.Modified, FileState.Unmodified)
    ], null, {
      operation: new GitOperation(OperationKind.Merge, "c0ffee0123456789abcdef0123456789abcdef01", "Merge branch 'main'"),
      remote: new GitRemote("nas", "nas.home", "notes", RemoteTransport.Ssh),
      truncated: true,
      branch: "feature"
    });
    const view: GitViewFixture = await GitViewFixture.renderAsync({ ...GitFixtures.watching, "git.status": status.toJson() });

    expect([...view.find(".body").children].map(t => t.localName === "div" ? t.className : t.localName)).toEqual([
      "nol-git-branch-card", "nol-git-host-row", "banner", "nol-git-file-group", "nol-git-file-group", "p", "nol-git-commit-card"
    ]);
    expect(view.texts(".banner .strong, .banner .muted, p.quiet")).toEqual([
      "Merging main into feature", "One file has conflicts. Resolve it, or abort.", "Git listed only part of this folder's changes."
    ]);
  });

  it("aborts the operation from its banner, with a button named for it at the banner's end, and reports an abort that fails outside Git", async () => {
    const status: GitStatus = GitFixtures.status([GitFixtures.entry("a.ts", FileState.Unmodified, FileState.Unmodified, null, ConflictKind.BothModified)], null,
      { operation: new GitOperation(OperationKind.CherryPick, "c".repeat(40), "Pick it") });
    let abort: JsonValue | Error = new Error("abort broke");
    const view: GitViewFixture = await GitViewFixture.renderAsync({ ...GitFixtures.watching, "git.status": status.toJson(), "git.abortOperation": () => abort });
    const handled: string[] = [];
    vi.spyOn(TestBed.inject(ErrorHandler), "handleError").mockImplementation(error => handled.push(String(error)));
    const button: HTMLButtonElement = view.find<HTMLButtonElement>(".banner .abort-operation");
    const banner: DOMRect = view.find(".banner").getBoundingClientRect();

    expect([button.textContent?.trim(), Math.round(banner.right - button.getBoundingClientRect().right) >= 0]).toEqual(["Abort cherry-pick", true]);
    button.click();
    await Wait.until(() => handled.length === 1);
    expect(handled).toEqual(["Error: abort broke"]);

    abort = null;
    button.click();
    await view.untilAsync(() => view.requested("git.abortOperation").length === 2);
    expect(view.requested("git.abortOperation")).toEqual([1, 2].map(() => ({ folder: GitFixtures.folder, basedOn: status.fingerprint })));
  });

  it("opens the folder's conflict screen at a conflicted file when its row's name is clicked", async () => {
    const view: GitViewFixture = await GitViewFixture.renderAsync({
      ...GitFixtures.watching,
      "git.status": GitFixtures.status([GitFixtures.entry("src/a.ts", FileState.Unmodified, FileState.Unmodified, null, ConflictKind.BothModified)], null,
        { operation: new GitOperation(OperationKind.Merge, "main", "Merge branch 'main'") }).toJson()
    });
    view.context.allow("openDocument");
    onTestFinished(() => GitResolving.opened.set(new Map()));

    view.find<HTMLButtonElement>("nol-git-file-group .file .name").click();

    expect(view.context.callsOf("openDocument")).toEqual([["git.conflicts", GitFixtures.folder, "Conflicts: project"]]);
    expect(GitResolving.pathOf(GitFixtures.folder)).toBe("src/a.ts");
  });

  it("opens the conflict screen at the first conflicted file from the banner's Resolve conflicts, before Abort, and drops it once every conflict is resolved", async () => {
    const conflicted: GitStatus = GitFixtures.status([
      GitFixtures.entry("b.ts", FileState.Modified, FileState.Unmodified),
      GitFixtures.entry("src/a.ts", FileState.Unmodified, FileState.Unmodified, null, ConflictKind.BothModified),
      GitFixtures.entry("src/c.ts", FileState.Unmodified, FileState.Unmodified, null, ConflictKind.BothModified)
    ], null, { operation: new GitOperation(OperationKind.Merge, "main", "Merge branch 'main'") });
    let status: GitStatus = conflicted;
    const view: GitViewFixture = await GitViewFixture.renderAsync({ ...GitFixtures.watching, "git.status": () => status.toJson() });
    view.context.allow("openDocument");
    onTestFinished(() => GitResolving.opened.set(new Map()));

    expect(view.texts(".banner .banner-action")).toEqual(["Resolve conflicts", "Abort merge"]);
    view.find<HTMLButtonElement>(".banner .resolve-conflicts").click();

    expect(view.context.callsOf("openDocument")).toEqual([["git.conflicts", GitFixtures.folder, "Conflicts: project"]]);
    expect(GitResolving.pathOf(GitFixtures.folder)).toBe("src/a.ts");

    status = GitFixtures.status([GitFixtures.entry("src/a.ts", FileState.Modified, FileState.Unmodified)], null,
      { operation: new GitOperation(OperationKind.Merge, "main", "Merge branch 'main'") });
    await view.state.refreshAsync();
    await view.untilAsync(() => view.all(".banner .resolve-conflicts").length === 0);

    expect(view.texts(".banner .banner-action")).toEqual(["Abort merge"]);
  });

  it("says how many Git LFS files the runtime couldn't check, after the files", async () => {
    const view: GitViewFixture = await GitViewFixture.renderAsync({
      ...GitFixtures.watching,
      "git.status": GitFixtures.status([GitFixtures.entry("a.bin", FileState.Unmodified, FileState.Modified)], null, { uncheckedLfsFiles: 3 }).toJson()
    });

    expect(view.texts(".lfs-unchecked")).toEqual(["Three Git LFS files weren't checked against their pointers, so they may show as changed when they aren't."]);
    expect([...view.find(".body").children].map(t => t.localName === "p" ? t.className : t.localName))
      .toEqual(["nol-git-branch-card", "nol-git-file-group", "quiet lfs-unchecked", "nol-git-commit-card"]);
  });

  it("says one unchecked Git LFS file in the singular", async () => {
    const view: GitViewFixture = await GitViewFixture.renderAsync({ ...GitFixtures.watching, "git.status": GitFixtures.status([], null, { uncheckedLfsFiles: 1 }).toJson() });

    expect(view.texts(".lfs-unchecked")).toEqual(["One Git LFS file wasn't checked against its pointer, so it may show as changed when it isn't."]);
  });

  it("titles the changes with the branch in place of the branch card when the app turns the card off", async () => {
    GitViewOptions.showsBranch.set(false);
    onTestFinished(() => GitViewOptions.showsBranch.set(true));
    const view: GitViewFixture = await GitViewFixture.renderAsync({ ...GitFixtures.watching, "git.status": GitFixtures.status().toJson() });

    expect([...view.find(".body").children].map(t => t.localName === "div" ? t.className : t.localName)).toEqual(["title", "p", "nol-git-commit-card"]);
    expect(view.texts(".title > span")).toEqual(["Changes", "on main"]);
  });

  it("titles the changes with the target branch while Git switches, then the old branch and Git's reason when Git refuses", async () => {
    GitViewOptions.showsBranch.set(false);
    onTestFinished(() => GitViewOptions.showsBranch.set(true));
    const answers: Readonly<Record<string, JsonValue>> = { ...GitFixtures.watching, "git.status": GitFixtures.status().toJson() };
    const view: GitViewFixture = await GitViewFixture.renderAsync(answers);
    const requests: GitHeldRequests = new GitHeldRequests(view.context, ["git.switchBranch"], answers);

    const switching: Promise<void> = view.state.switchBranchAsync("feature");
    await view.untilAsync(() => view.texts(".title > *")[1] === "on feature");
    await requests.answerAsync("git.switchBranch",
      GitFixtures.failure(FailureCode.Git, GitCode.ChangesInTheWay, "Your local changes to package-lock.json would be overwritten by checkout."));
    await switching;
    await view.waitForAsync("[role=alert]");

    expect(view.texts(".title > span")).toEqual(["Changes", "on main"]);
    expect(view.texts("[role=alert] > *")).toEqual(["error", "Your local changes to package-lock.json would be overwritten by checkout.", "Dismiss"]);
  });

  it("says there are no changes in a clean folder", async () => {
    const view: GitViewFixture = await GitViewFixture.renderAsync({ ...GitFixtures.watching, "git.status": GitFixtures.status().toJson() });

    expect(view.texts("p.quiet")).toEqual(["No changes"]);
    expect(view.all("nol-git-host-row, .banner")).toHaveLength(0);
  });

  it("shows a watch the runtime refuses as a notice, and watches and reads again on Check again", async () => {
    let watchFails: boolean = true;
    const view: GitViewFixture = await GitViewFixture.renderAsync({ ...GitFixtures.watching, "git.status": GitFixtures.status().toJson(), "git.watch": () => watchFails ? GitFixtures.lost("no watch") : null });

    await view.waitForAsync("[role=status]");
    const notice: readonly string[] = view.texts("[role=status] > *");
    const reads: number = view.requested("git.status").length;
    watchFails = false;
    const follows = vi.spyOn(view.state, "followAgainAsync");
    await view.clickAsync("[role=status] .banner-action");
    await follows.mock.results[0]?.value;
    await view.fixture.whenStable();

    expect(notice).toEqual(["sync_problem", "Changes made outside the Git view aren't followed, since the folder couldn't be watched: no watch", "Check again"]);
    expect([view.requested("git.watch").length, view.requested("git.status").length]).toEqual([2, reads + 1]);
    expect(view.all("[role=status]")).toHaveLength(0);
  });

  it("offers to undo a discard kept in a checkpoint until it is undone, dismissed or another write starts", async () => {
    const discard = (paths: readonly string[]): GitJournalEntry =>
      new GitJournalEntry("7", "git.discard", "2026-11-22T20:15:00Z", "main", "main", [], UndoMode.Checkpoint, null, null, "c-1", paths);
    const journals: GitJournal[] = [new GitJournal([discard(["b.ts"])], true), new GitJournal([discard(["a.ts", "b.ts"])], true)];
    const view: GitViewFixture = await GitViewFixture.renderAsync({
      ...GitFixtures.watching, "git.discard": null, "git.undo": null, "git.stage": null, "git.journal": () => journals.shift()?.toJson() ?? new GitJournal([]).toJson(),
      "git.status": GitFixtures.status([GitFixtures.entry("b.ts", FileState.Unmodified, FileState.Modified)]).toJson()
    });
    const banner = (): readonly string[] => view.texts(".discarded > *");

    await view.state.discardAsync(["b.ts"]);
    await view.fixture.whenStable();
    const one: readonly string[] = banner();
    const role: string | null = view.find(".discarded").getAttribute("role");
    await view.clickAsync(".discarded .undo");
    await view.untilAsync(() => view.requested("git.undo").length === 1);
    const undone: readonly string[] = banner();
    await view.state.discardAsync(["a.ts", "b.ts"]);
    await view.fixture.whenStable();
    const two: readonly string[] = banner();
    await view.clickAsync(".discarded .dismiss");
    const dismissed: readonly string[] = banner();
    await view.state.discardAsync(["b.ts"]);
    await view.fixture.whenStable();
    const unkept: readonly string[] = banner();

    expect([one, two]).toEqual([["restore_page", "Discarded the changes to b.ts.", "Undo", "Dismiss"], ["restore_page", "Discarded the changes to two files.", "Undo", "Dismiss"]]);
    expect([undone, dismissed, unkept, role]).toEqual([[], [], [], "status"]);
    expect(view.requested("git.undo")).toEqual([{ folder: GitFixtures.folder, id: "7", basedOn: "f1" }]);
  });

  it("shows a refused write as an alert until it is dismissed", async () => {
    const view: GitViewFixture = await GitViewFixture.renderAsync({
      ...GitFixtures.watching,
      "git.status": GitFixtures.status([GitFixtures.entry("b.ts", FileState.Modified, FileState.Unmodified)]).toJson(),
      "git.unstage": GitFixtures.failure(FailureCode.Git, GitCode.IndexLocked, "The index is locked.")
    });

    await view.clickAsync(".move");
    await view.waitForAsync("[role=alert]");
    const alert: readonly string[] = view.texts("[role=alert] > *");
    await view.clickAsync(".banner-action");

    expect(alert).toEqual(["error", "The index is locked.", "Dismiss"]);
    expect(view.all("[role=alert]")).toHaveLength(0);
  });

  it("moves the focus to the control after a dismissed alert, never to the page", async () => {
    const view: GitViewFixture = await GitViewFixture.renderAsync({
      ...GitFixtures.watching,
      "git.status": GitFixtures.status([GitFixtures.entry("b.ts", FileState.Modified, FileState.Unmodified)]).toJson(),
      "git.unstage": GitFixtures.failure(FailureCode.Git, GitCode.IndexLocked, "The index is locked.")
    });
    await view.clickAsync(".move");
    await view.waitForAsync("[role=alert]");
    const dismiss: HTMLElement = view.find("[role=alert] .banner-action");
    const controls: readonly HTMLElement[] = view.all("button:not(:disabled), a[href], input:not(:disabled)");
    const next: HTMLElement | undefined = controls[controls.indexOf(dismiss) + 1];

    dismiss.focus();
    await view.clickAsync("[role=alert] .banner-action");

    expect([view.all("[role=alert]").length, !Object.isUndefined(next) && document.activeElement === next]).toEqual([0, true]);
  });

  it.each([
    [GitCode.NoUpstream, "This branch has no upstream to pull from, or its upstream is gone. Publish it first."],
    [GitCode.Conflict, "Finish the merge or other operation in progress, and resolve and stage its conflicts, before pulling."],
    [GitCode.Diverged, "This branch and its upstream each have commits the other doesn't, so a pull can't fast-forward it. Merge or rebase it: in History, drag the upstream onto the branch."]
  ])("shows a pull refused as %s as an alert, and pulls again once it is dismissed", async (code, message) => {
    const view: GitViewFixture = await GitViewFixture.renderAsync({
      ...GitFixtures.watching,
      "git.status": GitFixtures.status([], new StatusUpstream("origin/main", 1, 2, false)).toJson(),
      "git.pull": GitFixtures.failure(FailureCode.Git, code, message)
    });

    await view.clickAsync(".pull");
    await view.waitForAsync("[role=alert]");
    const alert: readonly string[] = view.texts("[role=alert] > *");
    await view.clickAsync(".banner-action");
    const dismissed: number = view.all("[role=alert]").length;
    await view.clickAsync(".pull");

    expect([alert, dismissed]).toEqual([["error", message, "Dismiss"], 0]);
    expect(view.requested("git.pull")).toHaveLength(2);
  });

  it("offers a force push on a push refused as behind, asks first naming the commit the lease holds, and force pushes only on Force push", async () => {
    const id: string = "89abcdef0123456789abcdef0123456789abcdef";
    const view: GitViewFixture = await GitViewFixture.renderAsync({
      ...GitFixtures.watching, "git.forcePush": null, "git.push": GitFixtures.failure(FailureCode.Git, GitCode.PushBehind, "The branch is behind its upstream."),
      "git.status": GitFixtures.status([], new StatusUpstream("origin/main", 1, 2, false, id)).toJson()
    });
    const dialog = (): HTMLElement | null => document.querySelector("nol-git-force-push-dialog");
    const askAsync = async (): Promise<string> => {
      await view.clickAsync("[role=alert] .force-push");
      await view.untilAsync(() => (dialog()?.querySelector(".text")?.textContent ?? "") !== "");
      return [dialog()?.querySelector(".nol-dialog-title")?.textContent, dialog()?.querySelector(".text")?.textContent].join("|");
    };
    const answerAsync = async (selector: string): Promise<void> => {
      dialog()?.querySelector<HTMLElement>(selector)?.click();
      await view.untilAsync(() => Object.isNull(dialog()));
      await view.fixture.whenStable();
    };

    await view.state.pushAsync();
    await view.fixture.whenStable();
    const alert: readonly string[] = view.texts("[role=alert] > *");
    const asked: string = await askAsync();
    const focused: boolean = document.activeElement?.matches("nol-git-force-push-dialog .cancel") ?? false;
    await answerAsync(".cancel");
    const cancelled: number = view.requested("git.forcePush").length;
    await askAsync();
    await answerAsync(".force");
    await view.untilAsync(() => view.all("[role=alert]").length === 0);

    expect(alert).toEqual(["error", "The branch is behind its upstream.", "Force push\u2026", "Dismiss"]);
    expect([asked, focused, cancelled]).toEqual([
      "Force push with lease?|This replaces the commits origin/main has that main doesn't with main's, only while origin/main still points at 89abcde, "
      + "as the last fetch saw it. If anyone pushed since, the remote refuses it and nothing changes.", true, 0
    ]);
    expect(view.requested("git.forcePush")).toEqual([{ folder: GitFixtures.folder, expected: id, basedOn: "f1" }]);
  });

  it("offers a fetch, not a force push, for a push the remote refused for commits the last fetch hadn't seen, and fetches on Fetch", async () => {
    const view: GitViewFixture = await GitViewFixture.renderAsync({
      ...GitFixtures.watching, "git.fetch": null, "git.push": GitFixtures.failure(FailureCode.Git, GitCode.PushBehind, "The remote has commits this branch doesn't."),
      "git.status": GitFixtures.status([], new StatusUpstream("origin/main", 1, 0, false, "89abcdef0123456789abcdef0123456789abcdef")).toJson()
    });

    await view.state.pushAsync();
    await view.waitForAsync("[role=alert]");
    const alert: readonly string[] = view.texts("[role=alert] > *");
    await view.clickAsync("[role=alert] .fetch");
    await view.untilAsync(() => view.all("[role=alert]").length === 0);

    expect(alert).toEqual(["error", "The remote has commits this branch doesn't.", "Fetch", "Dismiss"]);
    expect(view.requested("git.fetch")).toEqual([{ folder: GitFixtures.folder, basedOn: "f1" }]);
  });

  it("lists the recent actions newest first with their times when the Undo menu opens, and undoes only one that can be undone", async () => {
    GitViewOptions.showsBranch.set(false);
    onTestFinished(() => GitViewOptions.showsBranch.set(true));
    const tree: string = "0123456789abcdef0123456789abcdef01234567";
    const at: string = "2026-11-22T20:15:00Z";
    const entries: readonly GitJournalEntry[] = [
      new GitJournalEntry("6", "git.stage", at, "main", "main", [], UndoMode.Index, tree, tree),
      new GitJournalEntry("7", "git.push", at, "main", "main", [], UndoMode.None, null, null),
      new GitJournalEntry("8", "git.example", at, null, null, [], UndoMode.None, null, null)
    ];
    const journals: GitJournal[] = [new GitJournal([]), new GitJournal(entries)];
    const view: GitViewFixture = await GitViewFixture.renderAsync({
      ...GitFixtures.watching, "git.undo": null, "git.journal": () => journals.shift()?.toJson() ?? new GitJournal(entries).toJson(),
      "git.status": GitFixtures.status().toJson()
    });
    const rows = (): readonly HTMLElement[] => [...document.querySelectorAll<HTMLElement>("button[nol-menu-item]")];
    const time: string = new Date(at).toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
    const openAsync = async (count: number): Promise<readonly (readonly unknown[])[]> => {
      await view.clickAsync(".title-undo .recent");
      await view.untilAsync(() => rows().length === count);
      const parts = (row: HTMLElement): string => [...row.querySelectorAll("*")].filter(t => t.children.length === 0).map(t => (t.textContent ?? "").trim()).filter(t => t !== "").join("|");
      return rows().map(t => [parts(t), t.getAttribute("aria-disabled") === "true"] as const);
    };

    const empty: readonly (readonly unknown[])[] = await openAsync(1);
    await userEvent.keyboard("{Escape}");
    await view.untilAsync(() => rows().length === 0);
    const listed: readonly (readonly unknown[])[] = await openAsync(3);
    await userEvent.keyboard("{Escape}");
    await view.untilAsync(() => rows().length === 0);
    await view.chooseAsync(".title-undo .recent", "Stage on main");

    expect(empty).toEqual([["No actions yet", true]]);
    expect(listed.map(t => t[1])).toEqual([true, true, false]);
    expect(listed.map(t => t[0])).toEqual([`git.example|${time}`, `Push on main|${time}`, `Stage on main|${time}|Undo`]);
    expect(view.requested("git.undo")).toEqual([{ folder: GitFixtures.folder, id: "6", basedOn: "f1" }]);
  });

  it("passes a recent-actions read that fails outside Git to the error handler, and keeps the menu open", async () => {
    const broken: Error = new Error("The runtime went away.");
    const view: GitViewFixture = await GitViewFixture.renderAsync({ ...GitFixtures.watching, "git.journal": broken, "git.status": GitFixtures.status().toJson() });
    const handled: unknown[] = [];
    vi.spyOn(TestBed.inject(ErrorHandler), "handleError").mockImplementation(error => handled.push(error));

    await view.clickAsync("nol-git-branch-card .recent-actions .recent");
    await view.untilAsync(() => handled.length > 0);

    expect([handled, [...document.querySelectorAll("button[nol-menu-item]")].map(t => t.textContent?.trim())]).toEqual([[broken], ["No actions yet"]]);
  });
});
