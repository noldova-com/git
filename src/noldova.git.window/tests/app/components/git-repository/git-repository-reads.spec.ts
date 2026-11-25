/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ErrorHandler, signal, type WritableSignal } from "@angular/core";
import { type ComponentFixture, TestBed } from "@angular/core/testing";
import "@noldova/context.core";
import type { JsonValue } from "@noldova/context.json";
import { FakeWindowPartContext } from "@noldova/desktop.window/testing";
import { FailureCode, GitCommit, GitGraph, GitGraphCommit, GitRef, GitRepositoryItems, GitWorktree, GitWorktrees, RefKind } from "@noldova/git.protocol";
import { describe, expect, it, onTestFinished, vi } from "vitest";

import { GitHistoryComponent } from "../../../../src/app/components/git-history/git-history.component.ts";
import { GitRepositoryComponent } from "../../../../src/app/components/git-repository/git-repository.component.ts";
import { GitBranchView } from "../../../../src/app/models/git-branch-view.ts";
import { GitCommitView } from "../../../../src/app/models/git-commit-view.ts";
import { GitRuntimeClient } from "../../../../src/app/services/git-runtime-client.ts";
import { GitViewing } from "../../../../src/app/services/git-viewing.ts";
import { GitFixtures } from "../../../fixtures/git-fixtures.fixture.ts";
import { GitHeldRequests } from "../../../fixtures/git-held-requests.fixture.ts";

describe("GitRepositoryComponent reads and writes", () => {
  const answers: Readonly<Record<string, JsonValue>> = {
    ...GitFixtures.watching,
    "git.status": GitFixtures.status().toJson(),
    "git.branches": GitFixtures.branches("main", ["feature", "main"], ["origin/main"]).toJson(),
    "git.worktrees": new GitWorktrees([]).toJson(),
    "git.repositoryItems": new GitRepositoryItems([], [], [], false).toJson(),
    "git.remoteTracks": { tracks: [] }
  };

  const domAsync = (element: HTMLElement, done: () => boolean): Promise<void> => {
    if (done())
      return Promise.resolve();
    return new Promise(resolve => {
      const observer: MutationObserver = new MutationObserver(() => {
        if (!done())
          return;
        observer.disconnect();
        resolve();
      });
      observer.observe(element, { attributes: true, characterData: true, childList: true, subtree: true });
    });
  };

  const mount = (context: FakeWindowPartContext): {
    readonly fixture: ComponentFixture<GitRepositoryComponent>; readonly element: HTMLElement; readonly folder: WritableSignal<string | null>; readonly handled: WritableSignal<string[]>;
  } => {
    const folder: WritableSignal<string | null> = GitFixtures.setUp(context);
    const handled: WritableSignal<string[]> = signal<string[]>([]);
    vi.spyOn(TestBed.inject(ErrorHandler), "handleError").mockImplementation(error => handled.update(t => [...t, String(error)]));
    const fixture: ComponentFixture<GitRepositoryComponent> = TestBed.createComponent(GitRepositoryComponent);
    fixture.autoDetectChanges();
    return { fixture, element: fixture.nativeElement, folder, handled };
  };

  const find = (element: HTMLElement, selector: string): HTMLElement => {
    const found: HTMLElement | null = element.querySelector<HTMLElement>(selector);
    if (Object.isNull(found))
      throw new Error(`Nothing matches ${selector}.`);
    return found;
  };
  const toggle = (element: HTMLElement, label: string): void =>
    [...element.querySelectorAll<HTMLElement>("button.toggle")].find(t => t.textContent?.includes(label))?.click();
  const dblclick = (target: HTMLElement): void => {
    target.dispatchEvent(new MouseEvent("dblclick", { bubbles: true }));
  };
  const alert = (element: HTMLElement): string => element.querySelector("[role=alert]")?.textContent?.trim() ?? "";
  const calls = (context: FakeWindowPartContext, method: string): number => context.callsOf("requestAsync").filter(t => t[0] === method).length;

  it("shows a local or remote branch in the history at a click, marking it, and opens the history from its row", async () => {
    onTestFinished(() => GitViewing.branch.set(null));
    const context: FakeWindowPartContext = new FakeWindowPartContext();
    context.allow("openDocument");
    GitFixtures.answerWith(context, { ...answers, "git.worktrees": new GitWorktrees([new GitWorktree("/work/project-fix", null, "fix", false, false)]).toJson() });
    const { element } = mount(context);
    await domAsync(element, () => !Object.isNull(element.querySelector("button[title=feature]")));
    toggle(element, "Worktrees");
    await domAsync(element, () => !Object.isNull(element.querySelector("[title='/work/project-fix']")));

    find(element, "button[title=feature]").click();
    await domAsync(element, () => find(element, "button[title=feature]").classList.contains("sel"));
    const local: GitBranchView | null = GitViewing.branch();
    toggle(element, "Remotes");
    await domAsync(element, () => !Object.isNull(element.querySelector("[title='origin/']")));
    find(element, "[title='origin/']").click();
    await domAsync(element, () => !Object.isNull(element.querySelector("[title='origin/main']")));
    find(element, "[title='origin/main']").click();
    await domAsync(element, () => find(element, "[title='origin/main']").classList.contains("sel"));
    [...element.querySelectorAll<HTMLElement>("button.row")].find(t => t.textContent?.includes("History"))?.click();
    const history: readonly unknown[] = ["git.history", GitFixtures.folder, "project"];

    expect([local, GitViewing.branch(), find(element, "button[title=feature]").classList.contains("sel")])
      .toEqual([new GitBranchView(GitFixtures.folder, "feature", false), new GitBranchView(GitFixtures.folder, "origin/main", true), false]);
    expect(context.callsOf("openDocument")).toEqual([history, history, history]);
  });

  describe("with the history open", () => {
    const head: string = "a".repeat(40);
    const feature: string = "b".repeat(40);
    const graph: GitGraph = new GitGraph([
      new GitGraphCommit(new GitCommit(head, [feature], "Sample Author", "2026-11-06T17:30:00Z", "Second"), "author@example.com",
        [new GitRef(RefKind.Head, "main"), new GitRef(RefKind.Branch, "main")]),
      new GitGraphCommit(new GitCommit(feature, [], "Sample Author", "2026-11-05T17:30:00Z", "First"), "author@example.com", [new GitRef(RefKind.Branch, "feature")])
    ], false);

    const mountWithHistory = (context: FakeWindowPartContext): { readonly element: HTMLElement; readonly history: HTMLElement } => {
      onTestFinished(() => {
        GitViewing.branch.set(null);
        GitViewing.showChanges(GitFixtures.folder);
      });
      context.allow("openDocument");
      const { element } = mount(context);
      const fixture: ComponentFixture<GitHistoryComponent> = TestBed.createComponent(GitHistoryComponent);
      fixture.componentRef.setInput("instance", GitFixtures.folder);
      fixture.autoDetectChanges();
      document.body.prepend(element);
      onTestFinished(() => element.remove());
      return { element, history: fixture.nativeElement };
    };
    const historyRow = (element: HTMLElement): HTMLElement => find(element, "button.row.history");
    const until = (done: () => boolean): Promise<boolean> => vi.waitUntil(done, { timeout: 5000 });
    const selectedIn = (history: HTMLElement): string | undefined => history.querySelector("[role=option][aria-selected=true]")?.textContent ?? undefined;

    it("selects the current branch's newest commit at a click on History, so History is marked and the Git panel shows it, opens the history and brings the Commit view forward", async () => {
      const context: FakeWindowPartContext = new FakeWindowPartContext();
      GitFixtures.answerWith(context, { ...answers, "git.status": GitFixtures.status([], null, { head }).toJson(), "git.graph": graph.toJson() });
      const { element, history } = mountWithHistory(context);
      await until(() => history.querySelectorAll("[role=option]").length >= 2 && !Object.isNull(element.querySelector("button[title=feature]")));
      const before: boolean = historyRow(element).classList.contains("sel");
      const opened: number = context.callsOf("openView").length;

      historyRow(element).click();
      await until(() => historyRow(element).classList.contains("sel"));

      expect([before, GitViewing.commitOf(GitFixtures.folder)?.folder, GitViewing.commitOf(GitFixtures.folder)?.commit.commit.id, historyRow(element).getAttribute("aria-current"), selectedIn(history)?.includes("Second")])
        .toEqual([false, GitFixtures.folder, head, "true", true]);
      expect([GitViewing.branch()?.branch, find(element, "button[title=main]").classList.contains("sel"), context.callsOf("openDocument"), opened,
      context.callsOf("openView")]).toEqual(["", false, [["git.history", GitFixtures.folder, "project"]], 0, [["git.commitView", "selected", "Commit"]]]);
    });

    it("selects the viewed branch's newest commit at a click on History after Changes showed the changes, rather than the current branch's, and brings the open Commit view forward again", async () => {
      const context: FakeWindowPartContext = new FakeWindowPartContext();
      GitFixtures.answerWith(context, { ...answers, "git.status": GitFixtures.status([], null, { head }).toJson(), "git.graph": graph.toJson() });
      const { element, history } = mountWithHistory(context);
      await until(() => history.querySelectorAll("[role=option]").length >= 2 && !Object.isNull(element.querySelector("button[title=feature]")));
      find(element, "button[title=feature]").click();
      await until(() => GitViewing.commitOf(GitFixtures.folder)?.commit.commit.id === feature);
      find(element, "button.row.changes").click();
      await until(() => !historyRow(element).classList.contains("sel"));
      const opened: number = context.callsOf("openView").length;

      historyRow(element).click();
      await until(() => historyRow(element).classList.contains("sel"));

      expect([GitViewing.commitOf(GitFixtures.folder)?.commit.commit.id, GitViewing.branch()?.branch, selectedIn(history)?.includes("First"), opened,
        context.callsOf("openView").length]).toEqual([feature, "feature", true, 1, 2]);
    });

    it("selects HEAD's newest commit at a click on History after the Git panel picked another commit, such as a parent", async () => {
      const context: FakeWindowPartContext = new FakeWindowPartContext();
      GitFixtures.answerWith(context, { ...answers, "git.status": GitFixtures.status([], null, { head }).toJson(), "git.graph": graph.toJson() });
      const { element, history } = mountWithHistory(context);
      await until(() => history.querySelectorAll("[role=option]").length >= 2 && !Object.isNull(element.querySelector("button.row.history")));
      GitViewing.branch.set(new GitBranchView(GitFixtures.folder, "", false, feature));
      await until(() => GitViewing.commitOf(GitFixtures.folder)?.commit.commit.id === feature);

      historyRow(element).click();
      await until(() => GitViewing.commitOf(GitFixtures.folder)?.commit.commit.id === head);

      expect([GitViewing.branch(), selectedIn(history)?.includes("Second")]).toEqual([new GitBranchView(GitFixtures.folder, "", false, head), true]);
    });

    it("only opens the history at a click on History in a repository without commits, keeping the changes shown", async () => {
      const context: FakeWindowPartContext = new FakeWindowPartContext();
      GitFixtures.answerWith(context, {
        ...answers, "git.status": GitFixtures.status([], null, { head: null }).toJson(), "git.branches": GitFixtures.branches("main", [], []).toJson(),
        "git.graph": new GitGraph([], false).toJson()
      });
      const { element, history } = mountWithHistory(context);
      await until(() => !Object.isNull(element.querySelector("button.row.history")) && context.callsOf("requestAsync").some(t => t[0] === "git.graph"));

      historyRow(element).click();

      expect([GitViewing.commitOf(GitFixtures.folder), GitViewing.branch(), historyRow(element).classList.contains("sel"), find(element, "button.row.changes").classList.contains("sel"),
        history.querySelector("[role=option][aria-selected=true]")]).toEqual([null, null, false, true, null]);
    });
  });

  it("marks Changes while the Git panel shows the changes and History while it shows a commit, of this repository only, and shows the changes again from Changes, bringing the Git view forward", async () => {
    onTestFinished(() => GitViewing.showChanges(GitFixtures.folder));
    const commit: GitGraphCommit = new GitGraphCommit(new GitCommit("a".repeat(40), [], "Sample Author", "2026-11-06T17:30:00Z", "Sample"), "author@example.com", []);
    const context: FakeWindowPartContext = new FakeWindowPartContext();
    GitFixtures.answerWith(context, answers);
    const { element } = mount(context);
    const row = (name: string): HTMLElement => find(element, `button.row.${name}`);
    const marks = (): readonly unknown[] => [row("changes").classList.contains("sel"), row("history").classList.contains("sel"),
      row("changes").getAttribute("aria-current"), row("history").getAttribute("aria-current")];
    await domAsync(element, () => !Object.isNull(element.querySelector("button.row.changes")));
    const changes: readonly unknown[] = marks();

    GitViewing.show(new GitCommitView("/work/other", commit));
    onTestFinished(() => GitViewing.showChanges("/work/other"));
    await domAsync(element, () => true);
    const other: readonly unknown[] = marks();
    GitViewing.show(new GitCommitView(GitFixtures.folder, commit));
    await domAsync(element, () => row("history").classList.contains("sel"));
    const history: readonly unknown[] = marks();
    row("changes").click();
    await domAsync(element, () => row("changes").classList.contains("sel"));

    expect([changes, other, history, marks(), GitViewing.commitOf(GitFixtures.folder), context.callsOf("openDocument"), context.callsOf("showView")]).toEqual([
      [true, false, "true", null], [true, false, "true", null], [false, true, null, "true"], [true, false, "true", null], null, [], [["git.view"]]]);
  });

  it("switches once at a double-click while a switch runs, never to the current branch, and reports a switch that fails outside Git", async () => {
    const context: FakeWindowPartContext = new FakeWindowPartContext();
    const held: GitHeldRequests = new GitHeldRequests(context, ["git.switchBranch"], answers);
    const { element, handled } = mount(context);
    await domAsync(element, () => !Object.isNull(element.querySelector("button[title=feature]")));

    dblclick(find(element, "button[title=main]"));
    dblclick(find(element, "button[title=feature]"));
    dblclick(find(element, "button[title=feature]"));
    await held.answerAsync("git.switchBranch", new Error("switch broke"));
    await GitFixtures.untilAsync(() => handled().length > 0);

    expect([calls(context, "git.switchBranch"), handled(), alert(element)]).toEqual([1, ["Error: switch broke"], ""]);
  });

  it("reads again when its own folder changes but not another's, reports a watch that fails outside Git, and stops watching when the folder closes", async () => {
    const context: FakeWindowPartContext = new FakeWindowPartContext();
    let branches: JsonValue = answers["git.branches"] ?? null;
    GitFixtures.answerWith(context, { ...answers, "git.watch": new Error("watch broke"), "git.unwatch": GitFixtures.failure(FailureCode.Git), "git.branches": () => branches });
    const { element, folder, handled } = mount(context);
    await domAsync(element, () => !Object.isNull(element.querySelector("button[title=feature]")));

    branches = GitFixtures.branches("main", ["main", "next"]).toJson();
    context.raiseEvent("git.changed", { folder: "/work/other" });
    context.raiseEvent("git.changed", { folder: GitFixtures.folder });
    await domAsync(element, () => !Object.isNull(element.querySelector("button[title=next]")));
    folder.set(null);
    await domAsync(element, () => element.querySelector(".note")?.textContent?.trim() === "Open a folder to see its Git state.");

    expect([calls(context, "git.branches"), calls(context, "git.unwatch"), handled()]).toEqual([2, 1, ["Error: watch broke"]]);
  });

  it("says when a read was lost, shows Git's refusal, and reports a read that fails outside Git", async () => {
    const context: FakeWindowPartContext = new FakeWindowPartContext();
    let status: JsonValue | Error = GitFixtures.lost("Window closed.");
    GitFixtures.answerWith(context, { ...answers, "git.status": () => status });
    const { element, handled } = mount(context);
    await domAsync(element, () => alert(element) === "The history couldn't be read.");

    status = GitFixtures.failure(FailureCode.Git, null, "Not a repository.");
    context.raiseEvent("git.changed", { folder: GitFixtures.folder });
    await domAsync(element, () => alert(element) === "Not a repository.");
    status = new Error("read broke");
    context.raiseEvent("git.changed", { folder: GitFixtures.folder });
    await GitFixtures.untilAsync(() => handled().length > 0);

    expect([handled(), alert(element), element.querySelector(".row.reading")]).toEqual([["Error: read broke"], "Not a repository.", null]);
  });

  it("shows the kit's spinner under Branches while the first read runs, hidden for the kit's delay so a fast read never flashes it, then the branches in its place", async () => {
    const context: FakeWindowPartContext = new FakeWindowPartContext();
    const held: GitHeldRequests = new GitHeldRequests(context, ["git.branches"], answers);
    const { element } = mount(context);
    await domAsync(element, () => !Object.isNull(element.querySelector(".row.reading nol-spinner")));
    const spinner: HTMLElement = find(element, ".row.reading nol-spinner");
    const pending: boolean = spinner.classList.contains("nol-reveal-pending");
    await domAsync(element, () => !spinner.classList.contains("nol-reveal-pending"));
    const shown: readonly (string | null)[] = [spinner.getAttribute("role"), (spinner.textContent ?? "").trim()];

    await held.answerAsync("git.branches", answers["git.branches"] ?? null);
    await domAsync(element, () => !Object.isNull(element.querySelector("button[title=feature]")));

    expect([pending, shown, element.querySelector(".row.reading")]).toEqual([true, ["status", "Reading the branches"], null]);
  });

  it("keeps only the newest read when older reads answer late, opens the remotes before any are read, and marks no branch current on a detached HEAD", async () => {
    const context: FakeWindowPartContext = new FakeWindowPartContext();
    const held: GitHeldRequests = new GitHeldRequests(context, ["git.branches"], answers);
    const reads = vi.spyOn(GitRuntimeClient.prototype, "branchesAsync");
    onTestFinished(() => reads.mockRestore());
    const { fixture, element } = mount(context);
    const settledAsync = async (): Promise<void> => {
      await Promise.allSettled(reads.mock.results.flatMap(t => t.type === "return" ? [t.value] : []));
      await fixture.whenStable();
    };
    const first: (answer: JsonValue | Error) => void = await held.nextAsync("git.branches");
    toggle(element, "Remotes");
    await fixture.whenStable();
    const before: boolean = Object.isNull(element.querySelector("[title^='origin']"));
    context.raiseEvent("git.changed", { folder: GitFixtures.folder });
    await held.answerAsync("git.branches", GitFixtures.branches(null, ["main", "other"]).toJson());
    await domAsync(element, () => !Object.isNull(element.querySelector("button[title=other]")));
    first(GitFixtures.branches("main", ["late"]).toJson());
    await settledAsync();
    const late: readonly unknown[] = [element.querySelector("button[title=late]"), !Object.isNull(element.querySelector("button[title=other]"))];
    context.raiseEvent("git.changed", { folder: GitFixtures.folder });
    const refused: (answer: JsonValue | Error) => void = await held.nextAsync("git.branches");
    context.raiseEvent("git.changed", { folder: GitFixtures.folder });
    await held.answerAsync("git.branches", GitFixtures.branches(null, ["main", "newest"]).toJson());
    await domAsync(element, () => !Object.isNull(element.querySelector("button[title=newest]")));
    refused(GitFixtures.failure(FailureCode.Git, null, "Late refusal."));
    await settledAsync();

    expect([before, late, element.querySelectorAll(".row .current").length, alert(element)]).toEqual([true, [null, true], 0, ""]);
  });

  const countsOf = (element: HTMLElement, branches: readonly string[]): readonly string[] =>
    branches.map(t => [...element.querySelectorAll(`[title='${t}'] .small`)].map(u => u.textContent?.trim()).join(" "));

  it("reads the remote branches' counts against HEAD only while Remotes is open, again after each read of the branches, and draws those ahead or behind", async () => {
    const context: FakeWindowPartContext = new FakeWindowPartContext();
    let branches: JsonValue = GitFixtures.branches("main", ["feature", "main"], ["origin/main", "origin/team/a", "origin/zero"]).toJson();
    let tracks: JsonValue = { tracks: [{ branch: "origin/main", ahead: 2, behind: 0 }, { branch: "origin/team/a", ahead: 0, behind: 3 }, { branch: "origin/zero", ahead: 0, behind: 0 }] };
    GitFixtures.answerWith(context, { ...answers, "git.branches": () => branches, "git.remoteTracks": () => tracks });
    const { element, handled } = mount(context);
    await domAsync(element, () => !Object.isNull(element.querySelector("button[title=feature]")));
    const closed: number = calls(context, "git.remoteTracks");

    toggle(element, "Remotes");
    await domAsync(element, () => !Object.isNull(element.querySelector("[title='origin/']")));
    find(element, "[title='origin/']").click();
    await domAsync(element, () => !Object.isNull(element.querySelector("[title='origin/team/']")));
    find(element, "[title='origin/team/']").click();
    await domAsync(element, () => countsOf(element, ["origin/main", "origin/team/a"]).every(t => t.length > 0));
    const drawn: readonly string[] = countsOf(element, ["origin/main", "origin/team/a", "origin/zero"]);
    const opened: number = calls(context, "git.remoteTracks");
    tracks = { tracks: [{ branch: "origin/main", ahead: 4, behind: 1 }] };
    context.raiseEvent("git.changed", { folder: GitFixtures.folder });
    await domAsync(element, () => countsOf(element, ["origin/main"])[0] === "↑4 ↓1");
    const reread: readonly string[] = countsOf(element, ["origin/main", "origin/team/a"]);
    toggle(element, "Remotes");
    branches = GitFixtures.branches("main", ["feature", "late", "main"], ["origin/main"]).toJson();
    context.raiseEvent("git.changed", { folder: GitFixtures.folder });
    await domAsync(element, () => !Object.isNull(element.querySelector("button[title=late]")));

    expect([closed, drawn, opened, reread, calls(context, "git.remoteTracks"), handled()]).toEqual([0, ["↑2", "↓3", ""], 1, ["↑4 ↓1", ""], 2, []]);
  });

  it("keeps only the newest read of the remote branches' counts, shows none when Git refuses it, and reports a read that fails outside Git", async () => {
    const context: FakeWindowPartContext = new FakeWindowPartContext();
    const held: GitHeldRequests = new GitHeldRequests(context, ["git.remoteTracks"], answers);
    const { element, handled } = mount(context);
    await domAsync(element, () => !Object.isNull(element.querySelector("button[title=feature]")));
    toggle(element, "Remotes");
    await domAsync(element, () => !Object.isNull(element.querySelector("[title='origin/']")));
    find(element, "[title='origin/']").click();
    const first: (answer: JsonValue | Error) => void = await held.nextAsync("git.remoteTracks");
    context.raiseEvent("git.changed", { folder: GitFixtures.folder });
    const second: (answer: JsonValue | Error) => void = await held.nextAsync("git.remoteTracks");
    context.raiseEvent("git.changed", { folder: GitFixtures.folder });
    const third: (answer: JsonValue | Error) => void = await held.nextAsync("git.remoteTracks");
    first({ tracks: [{ branch: "origin/main", ahead: 7, behind: 0 }] });
    second(new Error("late failure"));
    third({ tracks: [{ branch: "origin/main", ahead: 1, behind: 0 }] });
    await domAsync(element, () => countsOf(element, ["origin/main"])[0] === "↑1");
    const newest: readonly string[] = countsOf(element, ["origin/main"]);
    context.raiseEvent("git.changed", { folder: GitFixtures.folder });
    await held.answerAsync("git.remoteTracks", GitFixtures.failure(FailureCode.Git, null, "Not a repository."));
    await domAsync(element, () => countsOf(element, ["origin/main"])[0] === "");
    const refused: readonly unknown[] = [countsOf(element, ["origin/main"]), alert(element), handled()];
    context.raiseEvent("git.changed", { folder: GitFixtures.folder });
    await held.answerAsync("git.remoteTracks", new Error("tracks broke"));
    await GitFixtures.untilAsync(() => handled().length > 0);

    expect([newest, refused, countsOf(element, ["origin/main"]), handled()]).toEqual([["↑1"], [[""], "", []], [""], ["Error: tracks broke"]]);
  });
});
