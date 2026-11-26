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
import { FailureCode, FileState, GitCommit, GitGraph, GitGraphCommit, GitRef, RefKind, StatusUpstream } from "@noldova/git.protocol";
import { describe, expect, it, onTestFinished, vi } from "vitest";

import { GitHistoryComponent } from "../../../../src/app/components/git-history/git-history.component.ts";
import { GitBranchView } from "../../../../src/app/models/git-branch-view.ts";
import { GitPendingSwitch } from "../../../../src/app/services/git-pending-switch.ts";
import { GitViewing } from "../../../../src/app/services/git-viewing.ts";
import { GitFixtures } from "../../../fixtures/git-fixtures.fixture.ts";
import { GitHeldRequests } from "../../../fixtures/git-held-requests.fixture.ts";

class MountedHistory {
  public readonly fixture: ComponentFixture<GitHistoryComponent>;
  public readonly element: HTMLElement;
  public readonly handled: WritableSignal<string[]>;

  public constructor(fixture: ComponentFixture<GitHistoryComponent>, element: HTMLElement, handled: WritableSignal<string[]>) {
    this.fixture = fixture;
    this.element = element;
    this.handled = handled;
  }
}

describe("GitHistoryComponent reads and writes", () => {
  const commitOf = (id: string, parents: readonly string[], subject: string, refs: readonly GitRef[] = []): GitGraphCommit =>
    new GitGraphCommit(new GitCommit(id.repeat(40), parents.map(t => t.repeat(40)), "Sample Author", "2026-11-06T17:30:00Z", subject), "author@example.com", refs);
  const head: readonly GitRef[] = [new GitRef(RefKind.Head, "main"), new GitRef(RefKind.Branch, "main")];
  const twoCommits: GitGraph = new GitGraph([commitOf("a", ["b"], "Second", head), commitOf("b", [], "First")], false);
  const switchable = (tags: readonly string[] = []): GitGraph => new GitGraph([
    commitOf("a", ["b"], "Second", [...head, ...tags.map(t => new GitRef(RefKind.Tag, t))]), commitOf("b", [], "First", [new GitRef(RefKind.Branch, "feature")])
  ], false);
  const oneCommit: GitGraph = new GitGraph([commitOf("c", [], "Only", head)], false);

  const untilAsync = (element: HTMLElement, done: () => boolean): Promise<void> => {
    if (done())
      return Promise.resolve();
    return new Promise<void>(resolve => {
      const observer: MutationObserver = new MutationObserver(() => {
        if (!done())
          return;
        observer.disconnect();
        resolve();
      });
      observer.observe(element, { attributes: true, characterData: true, childList: true, subtree: true });
    });
  };

  const mount = (context: FakeWindowPartContext): MountedHistory => {
    GitFixtures.setUp(context);
    const handled: WritableSignal<string[]> = signal<string[]>([]);
    vi.spyOn(TestBed.inject(ErrorHandler), "handleError").mockImplementation(error => handled.update(t => [...t, String(error)]));
    const fixture: ComponentFixture<GitHistoryComponent> = TestBed.createComponent(GitHistoryComponent);
    fixture.componentRef.setInput("instance", GitFixtures.folder);
    fixture.autoDetectChanges();
    return new MountedHistory(fixture, fixture.nativeElement, handled);
  };

  const subjects = (element: HTMLElement): string[] => [...element.querySelectorAll("[role=option]")].map(t => (t.textContent ?? "").replace(/\s+/gu, " ").trim());
  const button = (element: HTMLElement, action: string): HTMLButtonElement =>
    element.querySelector<HTMLButtonElement>(`.toolbar button[data-action="${action}"]`) ?? element.ownerDocument.createElement("button");
  const unavailable = (element: HTMLElement, action: string): boolean => button(element, action).getAttribute("aria-disabled") === "true";
  const alert = (element: HTMLElement): string => element.querySelector("[role=alert]")?.textContent?.trim() ?? "";
  const graphCalls = (context: FakeWindowPartContext): number => context.callsOf("requestAsync").filter(t => t[0] === "git.graph").length;

  it("reads again when its own folder changes but not another's, reports a watch that fails outside Git, and stops watching when it closes", async () => {
    const context: FakeWindowPartContext = new FakeWindowPartContext();
    let shown: GitGraph = twoCommits;
    GitFixtures.answerWith(context, {
      "git.watch": new Error("watch broke"), "git.unwatch": GitFixtures.failure(FailureCode.Git), "git.status": GitFixtures.status().toJson(), "git.graph": () => shown.toJson()
    });
    const { fixture, element, handled } = mount(context);
    await untilAsync(element, () => subjects(element).length === 2);

    shown = oneCommit;
    context.raiseEvent("git.changed", { folder: "/work/other" });
    context.raiseEvent("git.changed", { folder: GitFixtures.folder });
    await untilAsync(element, () => subjects(element).length === 1);
    fixture.destroy();

    expect([graphCalls(context), handled(), context.callsOf("requestAsync").filter(t => t[0] === "git.unwatch").length]).toEqual([2, ["Error: watch broke"], 1]);
  });

  it("moves the selection with the arrow keys and shows the commit, ignores other keys, and dims rows the filter leaves out", async () => {
    onTestFinished(() => GitViewing.showChanges(GitFixtures.folder));
    const context: FakeWindowPartContext = new FakeWindowPartContext();
    GitFixtures.answerWith(context, { ...GitFixtures.watching, "git.status": GitFixtures.status().toJson(), "git.graph": twoCommits.toJson() });
    const { element } = mount(context);
    await untilAsync(element, () => subjects(element).length === 2);
    const list: HTMLElement = element.querySelector<HTMLElement>("[role=listbox]") ?? element;
    const press = (key: string): KeyboardEvent => {
      const event: KeyboardEvent = new KeyboardEvent("keydown", { key, cancelable: true, bubbles: true });
      list.dispatchEvent(event);
      return event;
    };
    const selected = (): string => element.querySelector("[aria-selected=true]")?.textContent ?? "";

    const down: KeyboardEvent = press("ArrowDown");
    await untilAsync(element, () => selected().includes("First"));
    const shown: string | undefined = GitViewing.commitOf(GitFixtures.folder)?.commit.commit.subject;
    press("ArrowDown");
    press("ArrowUp");
    await untilAsync(element, () => selected().includes("Second"));
    const other: KeyboardEvent = press("a");
    const search: HTMLInputElement = element.querySelector<HTMLInputElement>("input[type=search]") ?? element.ownerDocument.createElement("input");
    search.value = "First";
    search.dispatchEvent(new Event("input"));
    await untilAsync(element, () => !Object.isNull(element.querySelector("[role=option].dim")));

    expect([down.defaultPrevented, shown, other.defaultPrevented, [...element.querySelectorAll("[role=option]")].map(t => t.classList.contains("dim"))])
      .toEqual([true, "First", false, [true, false]]);
  });

  it("draws a merge's second parent as a curve into its lane", async () => {
    const context: FakeWindowPartContext = new FakeWindowPartContext();
    GitFixtures.answerWith(context, {
      ...GitFixtures.watching, "git.status": GitFixtures.status().toJson(),
      "git.graph": new GitGraph([commitOf("a", ["b", "c"], "Merge", head), commitOf("b", ["d"], "Main side"), commitOf("c", ["d"], "Side"), commitOf("d", [], "Start")], false).toJson()
    });
    const { element } = mount(context);
    await untilAsync(element, () => subjects(element).length === 4);
    const paths: string[] = [...element.querySelectorAll("path")].map(t => t.getAttribute("d") ?? "");

    expect([paths.some(t => t.includes("C")), paths.some(t => t.includes("V"))]).toEqual([true, true]);
  });

  it("fetches, pulls and pushes on the status it read, runs one write at a time, and shows Git's refusal but reports a failure outside Git", async () => {
    const context: FakeWindowPartContext = new FakeWindowPartContext();
    const held: GitHeldRequests = new GitHeldRequests(context, ["git.push"], {
      ...GitFixtures.watching, "git.fetch": null, "git.pull": null, "git.graph": twoCommits.toJson(), "git.status": GitFixtures.status([], new StatusUpstream("origin/main", 1, 0, false)).toJson()
    });
    const { element, handled } = mount(context);
    await untilAsync(element, () => !unavailable(element, "Push"));

    button(element, "Push").click();
    button(element, "Push").click();
    await held.answerAsync("git.push", GitFixtures.failure(FailureCode.Git, null, "Push refused."));
    await untilAsync(element, () => alert(element) === "Push refused." && !unavailable(element, "Pull"));
    button(element, "Pull").click();
    await untilAsync(element, () => alert(element) === "" && !unavailable(element, "Fetch"));
    button(element, "Fetch").click();
    await GitFixtures.untilAsync(() => context.callsOf("requestAsync").some(t => t[0] === "git.fetch"));
    await untilAsync(element, () => !unavailable(element, "Push"));
    button(element, "Push").click();
    await held.answerAsync("git.push", new Error("push broke"));
    await untilAsync(element, () => !unavailable(element, "Push"));
    await GitFixtures.untilAsync(() => handled().length > 0);
    const calls = context.callsOf("requestAsync");

    expect([calls.filter(t => t[0] === "git.push").length, calls.find(t => t[0] === "git.pull")?.[1], calls.find(t => t[0] === "git.fetch")?.[1], handled(), alert(element)])
      .toEqual([2, { folder: GitFixtures.folder, basedOn: "f1" }, { folder: GitFixtures.folder, basedOn: "f1" }, ["Error: push broke"], ""]);
  });

  it("undoes the last commit on the status it read", async () => {
    const context: FakeWindowPartContext = new FakeWindowPartContext();
    GitFixtures.answerWith(context, { ...GitFixtures.watching, "git.undoCommit": null, "git.graph": twoCommits.toJson(), "git.status": GitFixtures.status().toJson() });
    const { element } = mount(context);
    await untilAsync(element, () => !unavailable(element, "UndoCommit"));

    button(element, "UndoCommit").click();
    await GitFixtures.untilAsync(() => context.callsOf("requestAsync").some(t => t[0] === "git.undoCommit"));

    expect(context.callsOf("requestAsync").filter(t => t[0] === "git.undoCommit").map(t => t[1])).toEqual([{ folder: GitFixtures.folder, basedOn: "f1" }]);
  });

  it("stashes the changes with their untracked files on the status it read, and holds Stash while the folder has none", async () => {
    const context: FakeWindowPartContext = new FakeWindowPartContext();
    let changed: boolean = false;
    GitFixtures.answerWith(context, {
      ...GitFixtures.watching, "git.stash": null, "git.graph": twoCommits.toJson(),
      "git.status": () => (changed ? GitFixtures.status([GitFixtures.entry("a.ts", FileState.Unmodified, FileState.Modified)]) : GitFixtures.status()).toJson()
    });
    const { element } = mount(context);
    await untilAsync(element, () => !unavailable(element, "Fetch"));
    const clean: boolean = unavailable(element, "Stash");

    changed = true;
    context.raiseEvent("git.changed", { folder: GitFixtures.folder });
    await untilAsync(element, () => !unavailable(element, "Stash"));
    button(element, "Stash").click();
    await GitFixtures.untilAsync(() => context.callsOf("requestAsync").some(t => t[0] === "git.stash"));

    expect([clean, context.callsOf("requestAsync").filter(t => t[0] === "git.stash").map(t => t[1])])
      .toEqual([true, [{ folder: GitFixtures.folder, message: null, includeUntracked: true, basedOn: "f1" }]]);
  });

  it("opens a terminal in its folder through the terminal module's command while a write runs, and reports one the window couldn't open", async () => {
    const context: FakeWindowPartContext = new FakeWindowPartContext();
    const held: GitHeldRequests = new GitHeldRequests(context, ["git.fetch"], {
      ...GitFixtures.watching, "git.graph": twoCommits.toJson(), "git.status": GitFixtures.status().toJson()
    });
    let refused: boolean = false;
    context.answer("runCommandAsync", () => refused ? Promise.reject(new Error("No terminal module.")) : Promise.resolve(null));
    const { element, handled } = mount(context);
    await untilAsync(element, () => !unavailable(element, "Fetch"));

    button(element, "Fetch").click();
    const settle = await held.nextAsync("git.fetch");
    await untilAsync(element, () => unavailable(element, "Fetch"));
    const during: boolean = unavailable(element, "Terminal");
    button(element, "Terminal").click();
    settle(null);
    refused = true;
    button(element, "Terminal").click();
    await GitFixtures.untilAsync(() => handled().length > 0);

    expect([during, context.callsOf("runCommandAsync")]).toEqual([false, [["terminal.new", { folder: GitFixtures.folder }], ["terminal.new", { folder: GitFixtures.folder }]]]);
    expect(handled()).toEqual(["Error: No terminal module."]);
  });

  it("asks a new branch's name from Branch, creates it on the status it read, and creates none when cancelled", async () => {
    const context: FakeWindowPartContext = new FakeWindowPartContext();
    GitFixtures.answerWith(context, { ...GitFixtures.watching, "git.createBranch": null, "git.graph": twoCommits.toJson(), "git.status": GitFixtures.status().toJson() });
    const { fixture, element } = mount(context);
    const dialog = (): HTMLElement | null => document.querySelector("nol-git-bulk-branch-dialog");
    const part = <T extends HTMLElement>(selector: string): T => {
      const found: T | null | undefined = dialog()?.querySelector<T>(selector);
      if (Object.isNullOrUndefined(found))
        throw new Error(`The dialog has no ${selector}.`);
      return found;
    };
    const created = (): readonly unknown[] => context.callsOf("requestAsync").filter(t => t[0] === "git.createBranch").map(t => t[1]);
    await untilAsync(element, () => !unavailable(element, "Branch"));

    button(element, "Branch").click();
    await GitFixtures.untilAsync(() => !Object.isNull(dialog()));
    part<HTMLButtonElement>(".cancel").click();
    await GitFixtures.untilAsync(() => Object.isNull(dialog()));
    const cancelled: readonly unknown[] = created();
    button(element, "Branch").click();
    await GitFixtures.untilAsync(() => !Object.isNull(dialog()));
    await fixture.whenStable();
    const field: HTMLInputElement = part<HTMLInputElement>(".name");
    field.value = "feature/kit";
    field.dispatchEvent(new Event("input"));
    fixture.detectChanges();
    part<HTMLButtonElement>(".create").click();
    await GitFixtures.untilAsync(() => created().length > 0);

    expect(cancelled).toEqual([]);
    expect(created()).toEqual([{ folder: GitFixtures.folder, name: "feature/kit", basedOn: "f1" }]);
  });

  it("says when there are no commits, when Git refused the read and when the read was lost", async () => {
    const context: FakeWindowPartContext = new FakeWindowPartContext();
    let shown: JsonValue | Error = new GitGraph([], false).toJson();
    GitFixtures.answerWith(context, { ...GitFixtures.watching, "git.status": GitFixtures.status().toJson(), "git.graph": () => shown });
    const { element } = mount(context);
    const note = (): string => element.querySelector(".note")?.textContent?.trim() ?? "";
    await untilAsync(element, () => note() === "No commits yet.");

    shown = GitFixtures.failure(FailureCode.Git, null, "Not a repository.");
    context.raiseEvent("git.changed", { folder: GitFixtures.folder });
    await untilAsync(element, () => note() === "Not a repository.");
    shown = GitFixtures.lost("Window closed.");
    context.raiseEvent("git.changed", { folder: GitFixtures.folder });
    await untilAsync(element, () => note() === "The history couldn't be read.");

    expect(note()).toBe("The history couldn't be read.");
  });

  it("draws the history when the status read fails outside Git, and reports that failure", async () => {
    const context: FakeWindowPartContext = new FakeWindowPartContext();
    GitFixtures.answerWith(context, { ...GitFixtures.watching, "git.status": new Error("status broke"), "git.graph": twoCommits.toJson() });
    const { element, handled } = mount(context);
    await untilAsync(element, () => subjects(element).length === 2);
    await GitFixtures.untilAsync(() => handled().length > 0);

    expect([handled(), alert(element), unavailable(element, "Pull")]).toEqual([["Error: status broke"], "", true]);
  });

  it("keeps only the newest read's history and status when older reads answer late", async () => {
    const context: FakeWindowPartContext = new FakeWindowPartContext();
    const held: GitHeldRequests = new GitHeldRequests(context, ["git.graph", "git.status"], GitFixtures.watching);
    const { element } = mount(context);
    const status = (ahead: number): JsonValue => GitFixtures.status([], new StatusUpstream("origin/main", ahead, 0, false)).toJson();
    await held.answerAsync("git.graph", twoCommits.toJson());
    await untilAsync(element, () => subjects(element).length === 2);

    context.raiseEvent("git.changed", { folder: GitFixtures.folder });
    await held.answerAsync("git.status", status(5));
    context.raiseEvent("git.changed", { folder: GitFixtures.folder });
    await held.answerAsync("git.graph", new GitGraph([commitOf("e", [], "Late")], false).toJson());
    context.raiseEvent("git.changed", { folder: GitFixtures.folder });
    await held.answerAsync("git.graph", GitFixtures.failure(FailureCode.Git, null, "Late refusal."));
    await held.answerAsync("git.graph", oneCommit.toJson());
    await held.answerAsync("git.status", status(9));
    await held.answerAsync("git.status", status(9));
    await held.answerAsync("git.status", status(2));
    await untilAsync(element, () => subjects(element).length === 1 && button(element, "Push").getAttribute("aria-label") === "Push 2");

    expect([subjects(element)[0]?.includes("Only"), alert(element)]).toEqual([true, ""]);
  });

  it("keeps a branch switch's ring through a read, or a failed read, that began while the switch ran", async () => {
    const context: FakeWindowPartContext = new FakeWindowPartContext();
    let shown: JsonValue | Error = switchable().toJson();
    GitFixtures.answerWith(context, { ...GitFixtures.watching, "git.status": GitFixtures.status().toJson(), "git.graph": () => shown });
    const { element } = mount(context);
    const ring = (): number => [...element.querySelectorAll("[role=option]")].findIndex(t => !Object.isNull(t.querySelector("circle.ring")));
    await untilAsync(element, () => ring() === 0);
    let open: () => void = () => undefined;
    const switching: Promise<void> = GitPendingSwitch.runAsync(GitFixtures.folder, "feature", () => new Promise<void>(resolve => {
      open = resolve;
    }));
    await untilAsync(element, () => ring() === 1);

    shown = switchable(["v2"]).toJson();
    context.raiseEvent("git.changed", { folder: GitFixtures.folder });
    await untilAsync(element, () => !Object.isNull(element.querySelector(".chip.ltag")));
    const kept: number = ring();
    shown = GitFixtures.failure(FailureCode.Git, null, "Busy.");
    context.raiseEvent("git.changed", { folder: GitFixtures.folder });
    await untilAsync(element, () => alert(element) === "Busy.");
    shown = switchable().toJson();
    open();
    await switching;
    await untilAsync(element, () => ring() === 0);

    expect(kept).toBe(1);
  });

  it("stops paging for a branch once the history ends without it, pages once while a page is out, drops a page a newer read overtook, and reports a page that fails outside Git", async () => {
    onTestFinished(() => GitViewing.branch.set(null));
    const context: FakeWindowPartContext = new FakeWindowPartContext();
    const held: GitHeldRequests = new GitHeldRequests(context, ["git.graph"], { ...GitFixtures.watching, "git.status": GitFixtures.status().toJson() });
    const { fixture, element, handled } = mount(context);
    const view = (branch: string): void => GitViewing.branch.set(new GitBranchView(GitFixtures.folder, branch, false));
    (await held.nextAsync("git.graph"))(new GitGraph(twoCommits.commits, true).toJson());
    await untilAsync(element, () => subjects(element).length === 2);
    const overtaken: (answer: JsonValue | Error) => void = await held.nextAsync("git.graph");

    view("old1");
    view("old2");
    await fixture.whenStable();
    context.raiseEvent("git.changed", { folder: GitFixtures.folder });
    const newer: (answer: JsonValue | Error) => void = await held.nextAsync("git.graph");
    overtaken(new GitGraph([commitOf("f", [], "Dropped")], true).toJson());
    newer(new GitGraph([...twoCommits.commits, commitOf("8", [], "Newer")], true).toJson());
    await untilAsync(element, () => subjects(element).length === 3);
    (await held.nextAsync("git.graph"))(new Error("page broke"));
    await GitFixtures.untilAsync(() => handled().length > 0);
    view("old3");
    (await held.nextAsync("git.graph"))(new GitGraph([commitOf("9", [], "Last")], false).toJson());
    await untilAsync(element, () => subjects(element).length === 4);
    await fixture.whenStable();

    expect([graphCalls(context), subjects(element).some(t => t.includes("Dropped")), handled()]).toEqual([5, false, ["Error: page broke"]]);
  });
});
