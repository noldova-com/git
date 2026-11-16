/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { computed } from "@angular/core";
import { type ComponentFixture, TestBed } from "@angular/core/testing";
import { WindowPartTokens } from "@noldova/desktop.window";
import { FakeWindowPartContext } from "@noldova/desktop.window/testing";
import type { JsonValue } from "@noldova/context.json";
import { ConflictKind, FailureCode, FileState, GitCode, GitOperation, GitRemote, OperationKind, RemoteTransport, StatusUpstream } from "@noldova/git.protocol";
import { describe, expect, it, onTestFinished, vi } from "vitest";

import { GitViewComponent } from "../../../../src/app/components/git-view/git-view.component.ts";
import { GitFolder } from "../../../../src/app/services/git-folder.ts";
import { GitFixtures } from "../../../fixtures/git-fixtures.fixture.ts";
import { GitViewFixture } from "../../../fixtures/git-view.fixture.ts";

describe("GitViewComponent", () => {
  it("says there is no folder until the app gives one", async () => {
    const view: GitViewFixture = await GitViewFixture.renderAsync({ ...GitFixtures.watching, "git.status": GitFixtures.status().toJson() });
    view.folder.set(null);
    await view.waitForAsync(".empty");

    expect(view.texts(".empty-icon, .heading, .text")).toEqual(["folder_off", "No folder", "Open a folder to see its Git state."]);
    expect(view.all(".actions")).toHaveLength(0);
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

  it("says the folder isn't a repository, naming it", async () => {
    const view: GitViewFixture = await GitViewFixture.renderAsync({ ...GitFixtures.watching, "git.status": GitFixtures.failure(FailureCode.NotRepository) }, ".empty");

    expect(view.texts(".heading, .text")).toEqual(["Not a Git repository", "This folder, /work/project, isn't inside a Git repository."]);
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
      operation: new GitOperation(OperationKind.Merge, "main", "Merge branch 'main'"),
      remote: new GitRemote("nas", "nas.home", "notes", RemoteTransport.Ssh),
      truncated: true
    });
    const view: GitViewFixture = await GitViewFixture.renderAsync({ ...GitFixtures.watching, "git.status": status.toJson() });

    expect([...view.find(".body").children].map(t => t.localName === "div" ? t.className : t.localName)).toEqual([
      "nol-git-branch-card", "nol-git-host-row", "banner", "nol-git-file-group", "nol-git-file-group", "p", "nol-git-commit-card"
    ]);
    expect(view.texts(".banner .strong, .banner .muted, p.quiet")).toEqual([
      "Merging main into this branch", "1 file has conflicts. Resolve them in your editor, or ask a teammate, then stage them.", "Git listed only part of this folder's changes."
    ]);
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

  it.each([
    [GitCode.NoUpstream, "This branch has no upstream to pull from, or its upstream is gone. Publish it first."],
    [GitCode.Conflict, "Finish the merge or other operation in progress, and resolve and stage its conflicts, before pulling."],
    [GitCode.Diverged, "This branch and its upstream each have commits the other doesn't, so a pull can't fast-forward it. Merge or rebase it in your editor or a terminal."]
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
});
