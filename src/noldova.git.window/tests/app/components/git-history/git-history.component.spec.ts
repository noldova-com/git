/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { signal, type WritableSignal } from "@angular/core";
import { type ComponentFixture, TestBed } from "@angular/core/testing";
import "@noldova/context.core";
import { WindowPartTokens } from "@noldova/desktop.window";
import { FakeWindowPartContext } from "@noldova/desktop.window/testing";
import { FileState, GitCommit, GitGraph, GitGraphCommit, GitRef, RefKind, StatusUpstream } from "@noldova/git.protocol";
import { DefaultTheme } from "@noldova/ui.components.angular";
import { AppearanceFixture } from "@noldova/ui.components.angular/testing";
import { describe, expect, it, onTestFinished } from "vitest";

import { GitHistoryComponent } from "../../../../src/app/components/git-history/git-history.component.ts";
import { GitBranchView } from "../../../../src/app/models/git-branch-view.ts";
import type { GitCommitView } from "../../../../src/app/models/git-commit-view.ts";
import { GitAvatars } from "../../../../src/app/services/git-avatars.ts";
import { GitCommitDetails } from "../../../../src/app/services/git-commit-details.ts";
import type { GitDetailView } from "../../../../src/app/services/git-detail-view.ts";
import { GitFolder } from "../../../../src/app/services/git-folder.ts";
import { GitPendingSwitch } from "../../../../src/app/services/git-pending-switch.ts";
import { GitRecentRepositories } from "../../../../src/app/services/git-recent-repositories.ts";
import { GitViewing } from "../../../../src/app/services/git-viewing.ts";
import { GitFixtures } from "../../../fixtures/git-fixtures.fixture.ts";
import { GitHeldRequests } from "../../../fixtures/git-held-requests.fixture.ts";

describe("GitHistoryComponent", () => {
  const graph: GitGraph = new GitGraph([
    new GitGraphCommit(new GitCommit("a".repeat(40), ["b".repeat(40)], "Sample Author", "2026-11-06T17:30:00Z", "Second"), "author@example.com",
      [new GitRef(RefKind.Head, "main"), new GitRef(RefKind.Branch, "main")]),
    new GitGraphCommit(new GitCommit("b".repeat(40), [], "Sample Author", "2026-11-05T17:30:00Z", "First"), "author@example.com", [])
  ], false);

  it("watches its folder and reads it once when it opens, not again on what it read", async () => {
    const context: FakeWindowPartContext = new FakeWindowPartContext();
    GitFixtures.answerWith(context, { ...GitFixtures.watching, "git.status": GitFixtures.status().toJson(), "git.graph": graph.toJson() });
    GitFixtures.setUp(context);
    const fixture: ComponentFixture<GitHistoryComponent> = TestBed.createComponent(GitHistoryComponent);
    fixture.componentRef.setInput("instance", GitFixtures.folder);
    fixture.autoDetectChanges();
    const element: HTMLElement = fixture.nativeElement;

    await new Promise<void>(resolve => {
      const observer: MutationObserver = new MutationObserver(() => {
        if (element.querySelectorAll("[role=option]").length === 2) {
          observer.disconnect();
          resolve();
        }
      });
      observer.observe(element, { childList: true, subtree: true });
    });
    await fixture.whenStable();
    const calls: readonly string[] = context.callsOf("requestAsync").map(t => String(t[0]));

    expect(["git.watch", "git.unwatch", "git.graph", "git.status"].map(t => calls.filter(u => u === t).length)).toEqual([1, 0, 1, 1]);
  });

  const graphWithHeadOn = (branch: string, tags: readonly string[] = []): GitGraph => new GitGraph([
    new GitGraphCommit(new GitCommit("a".repeat(40), ["b".repeat(40)], "Sample Author", "2026-11-06T17:30:00Z", "Second"), "author@example.com",
      [...branch === "main" ? [new GitRef(RefKind.Head, "main")] : [], new GitRef(RefKind.Branch, "main")]),
    new GitGraphCommit(new GitCommit("b".repeat(40), [], "Sample Author", "2026-11-05T17:30:00Z", "First"), "author@example.com",
      [...branch === "feature" ? [new GitRef(RefKind.Head, "feature")] : [], new GitRef(RefKind.Branch, "feature"), ...tags.map(t => new GitRef(RefKind.Tag, t))])
  ], false);

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
      observer.observe(element, { attributes: true, childList: true, subtree: true });
    });
  };

  const ringOf = (element: HTMLElement): number => [...element.querySelectorAll("[role=option]")].findIndex(t => !Object.isNull(t.querySelector("circle.ring")));

  const renderAsync = async (shown: () => GitGraph): Promise<{ readonly element: HTMLElement; readonly context: FakeWindowPartContext }> => {
    const context: FakeWindowPartContext = new FakeWindowPartContext();
    new GitHeldRequests(context, ["git.status"], { ...GitFixtures.watching, "git.graph": () => shown().toJson() });
    GitFixtures.setUp(context);
    const fixture: ComponentFixture<GitHistoryComponent> = TestBed.createComponent(GitHistoryComponent);
    fixture.componentRef.setInput("instance", GitFixtures.folder);
    fixture.autoDetectChanges();
    const element: HTMLElement = fixture.nativeElement;
    await untilAsync(element, () => ringOf(element) === 0);
    return { element, context };
  };

  const gate = (): { readonly promise: Promise<void>; readonly open: () => void } => {
    let open: () => void = () => undefined;
    const promise: Promise<void> = new Promise<void>(resolve => {
      open = resolve;
    });
    return { promise, open };
  };

  it("shows each author's picture in place of their initials once a host has it, as a circle of the same size in the same place, asking by the row's commit", async () => {
    const image = signal<string | null>(null);
    const asked: string[] = [];
    onTestFinished(GitAvatars.provide({
      avatarOf: (folder, email, commitId) => {
        asked.push(`${folder} ${email} ${commitId}`);
        return commitId === "a".repeat(40) ? image() : null;
      }
    }));
    const { element } = await renderAsync(() => graph);
    await untilAsync(element, () => element.querySelectorAll("span.av").length === 2);
    const rem = (pixels: number): number => pixels / parseFloat(getComputedStyle(document.documentElement).fontSize);
    const boxOf = (): readonly number[] => {
      const avatar = element.querySelector(".av")?.getBoundingClientRect();
      const cell = element.querySelector(".av")?.parentElement?.getBoundingClientRect();
      return [rem((avatar?.left ?? 0) - (cell?.left ?? 0)), rem((avatar?.top ?? 0) - (cell?.top ?? 0)), rem(avatar?.width ?? 0), rem(avatar?.height ?? 0)];
    };
    const initials = boxOf();

    image.set("data:image/png;base64,iVBORw0KGgo=");
    await untilAsync(element, () => element.querySelectorAll("img.av").length === 1);

    const picture = element.querySelector("img.av");
    expect([boxOf(), element.querySelectorAll("span.av").length, picture?.getAttribute("src"), getComputedStyle(picture ?? element).borderRadius])
      .toEqual([initials, 1, "data:image/png;base64,iVBORw0KGgo=", "50%"]);
    expect(initials.slice(2)).toEqual([1.125, 1.125]);
    expect([...new Set(asked)].sort()).toEqual([`${GitFixtures.folder} author@example.com ${"a".repeat(40)}`, `${GitFixtures.folder} author@example.com ${"b".repeat(40)}`]);
  });

  it("draws the graph before the status answers, moves the current branch's ring at the click, and keeps it once a read after the switch agrees", async () => {
    let shown: GitGraph = graphWithHeadOn("main");
    const { element, context } = await renderAsync(() => shown);
    const switching = gate();

    const done: Promise<void> = GitPendingSwitch.runAsync(GitFixtures.folder, "feature", () => switching.promise);
    await untilAsync(element, () => ringOf(element) === 1);
    shown = graphWithHeadOn("feature", ["v1"]);
    switching.open();
    await done;
    await untilAsync(element, () => !Object.isNull(element.querySelector(".chip.ltag")));

    expect([ringOf(element), context.callsOf("requestAsync").filter(t => t[0] === "git.graph").length]).toEqual([1, 2]);
  });

  it("puts the ring back on the old branch once a read after a refused switch shows it there", async () => {
    const { element } = await renderAsync(() => graphWithHeadOn("main"));
    const switching = gate();

    const done: Promise<void> = GitPendingSwitch.runAsync(GitFixtures.folder, "feature", () => switching.promise);
    await untilAsync(element, () => ringOf(element) === 1);
    switching.open();
    await done;
    await untilAsync(element, () => ringOf(element) === 0);

    expect(ringOf(element)).toBe(0);
  });

  it("reads further pages until a viewed branch's commit shows, then selects it and shows it in the Commit view; a click on the changes row shows the changes again", async () => {
    onTestFinished(() => {
      GitViewing.branch.set(null);
      GitViewing.showChanges(GitFixtures.folder);
    });
    const commitAt = (index: number, refs: readonly GitRef[]): GitGraphCommit => new GitGraphCommit(
      new GitCommit(index.toString(16).padStart(40, "0"), [(index + 1).toString(16).padStart(40, "0")], "Sample Author", "2026-11-06T17:30:00Z", `Commit ${index}`),
      "author@example.com", refs);
    const context: FakeWindowPartContext = new FakeWindowPartContext();
    context.answer("requestAsync", async (method: string, params: unknown) => {
      if (method === "git.graph")
        return Object.isObject(params) && "skip" in params && params.skip === 0
          ? new GitGraph([commitAt(1, [new GitRef(RefKind.Head, "main"), new GitRef(RefKind.Branch, "main")]), commitAt(2, [])], true).toJson()
          : new GitGraph([commitAt(3, []), commitAt(4, [new GitRef(RefKind.Branch, "old")])], false).toJson();
      return GitFixtures.answerFor({ ...GitFixtures.watching, "git.status": GitFixtures.status([GitFixtures.entry("a.ts", FileState.Unmodified, FileState.Modified)]).toJson() }, method);
    });
    GitFixtures.setUp(context);
    const fixture: ComponentFixture<GitHistoryComponent> = TestBed.createComponent(GitHistoryComponent);
    fixture.componentRef.setInput("instance", GitFixtures.folder);
    fixture.autoDetectChanges();
    const element: HTMLElement = fixture.nativeElement;
    const selected = (): string => (element.querySelector("[aria-selected=true]")?.textContent ?? "").replace(/\s+/gu, " ").trim();
    await untilAsync(element, () => element.querySelectorAll("[role=option]").length > 0);

    GitViewing.branch.set(new GitBranchView(GitFixtures.folder, "old", false));
    await untilAsync(element, () => selected().includes("Commit 4"));
    const shown: string | undefined = GitViewing.commitOf(GitFixtures.folder)?.commit.commit.subject;
    element.querySelector<HTMLElement>("[role=option]")?.click();
    await untilAsync(element, () => Object.isNull(GitViewing.commitOf(GitFixtures.folder)));
    const options = (): readonly HTMLElement[] => [...element.querySelectorAll<HTMLElement>("[role=option]")];
    options()[2]?.click();
    await untilAsync(element, () => selected().includes("Commit 2"));
    GitViewing.showChanges(GitFixtures.folder);
    await untilAsync(element, () => options()[0]?.getAttribute("aria-selected") === "true");

    expect([shown, context.callsOf("requestAsync").filter(t => t[0] === "git.graph").length, GitViewing.branch()]).toEqual(["Commit 4", 2, null]);
  });

  it("brings the Commit view to the front, through openView only, once for each commit the person clicks, and shows its choice there until it closes",
    async () => {
    onTestFinished(() => GitViewing.showChanges(GitFixtures.folder));
    const context: FakeWindowPartContext = new FakeWindowPartContext();
    GitFixtures.answerWith(context, { ...GitFixtures.watching, "git.status": GitFixtures.status().toJson(), "git.graph": graph.toJson() });
    GitFixtures.setUp(context, [{ provide: WindowPartTokens.activeDocument, useValue: signal(true) }]);
    const fixture: ComponentFixture<GitHistoryComponent> = TestBed.createComponent(GitHistoryComponent);
    fixture.componentRef.setInput("instance", GitFixtures.folder);
    fixture.autoDetectChanges();
    const element: HTMLElement = fixture.nativeElement;
    const details: GitDetailView<GitCommitView> = GitCommitDetails.of(context);
    const options = (): readonly HTMLElement[] => [...element.querySelectorAll<HTMLElement>("[role=option]")];
    await untilAsync(element, () => options().length === 2);
    const opened: number = context.callsOf("openView").length;

    options()[1]?.click();
    await fixture.whenStable();
    const first: string | undefined = details.shown()?.commit.commit.subject;
    options()[0]?.click();
    await fixture.whenStable();
    const second: string | undefined = details.shown()?.commit.commit.subject;
    fixture.destroy();

    expect([opened, context.callsOf("openView"), context.callsOf("showView"), first, second, details.shown()])
      .toEqual([0, [["git.commitView", "selected", "Commit"], ["git.commitView", "selected", "Commit"]], [["git.repository"]],
        "First", "Second", null]);
  });

  it("keeps each folder's chosen commit, so a commit chosen in one History leaves another folder's History on its own", async () => {
    const other: string = "/work/other";
    onTestFinished(() => [GitFixtures.folder, other].forEach(t => GitViewing.showChanges(t)));
    const context: FakeWindowPartContext = new FakeWindowPartContext();
    GitFixtures.answerWith(context, { ...GitFixtures.watching, "git.status": GitFixtures.status().toJson(), "git.graph": graph.toJson() });
    GitFixtures.setUp(context, [{ provide: WindowPartTokens.activeDocument, useValue: signal(true) }]);
    const historyOf = (folder: string): HTMLElement => {
      const fixture: ComponentFixture<GitHistoryComponent> = TestBed.createComponent(GitHistoryComponent);
      fixture.componentRef.setInput("instance", folder);
      fixture.autoDetectChanges();
      return fixture.nativeElement;
    };
    const first: HTMLElement = historyOf(GitFixtures.folder);
    const second: HTMLElement = historyOf(other);
    const options = (element: HTMLElement): readonly HTMLElement[] => [...element.querySelectorAll<HTMLElement>("[role=option]")];
    const selected = (element: HTMLElement): string => (element.querySelector("[aria-selected=true]")?.textContent ?? "").replace(/\s+/gu, " ").trim();
    await untilAsync(first, () => options(first).length === 2);
    await untilAsync(second, () => options(second).length === 2);

    options(first)[1]?.click();
    await untilAsync(first, () => selected(first).includes("First"));
    options(second)[0]?.click();
    await untilAsync(second, () => selected(second).includes("Second"));

    expect([GitViewing.commitOf(GitFixtures.folder)?.commit.commit.subject, GitViewing.commitOf(other)?.commit.commit.subject, selected(first).includes("First")])
      .toEqual(["First", "Second", true]);
  });

  it("points the panels at its repository only once its tab is the window's active document, whatever tab is drawn in front of it", async () => {
    const active: WritableSignal<boolean> = signal(false);
    const context: FakeWindowPartContext = new FakeWindowPartContext();
    GitFixtures.answerWith(context, { ...GitFixtures.watching, "git.status": GitFixtures.status().toJson(), "git.graph": graph.toJson() });
    GitFixtures.setUp(context, [{ provide: WindowPartTokens.activeDocument, useValue: active }]);
    const fixture: ComponentFixture<GitHistoryComponent> = TestBed.createComponent(GitHistoryComponent);
    fixture.componentRef.setInput("instance", "/work/other");
    fixture.autoDetectChanges();
    await fixture.whenStable();
    const before: string | null = GitFolder.folder();

    active.set(true);
    await fixture.whenStable();

    expect([before, GitFolder.folder()]).toEqual([GitFixtures.folder, "/work/other"]);
  });

  it("brings the Repository view forward, wherever the person put it, each time its tab becomes the window's active document", async () => {
    const active: WritableSignal<boolean> = signal(false);
    const context: FakeWindowPartContext = new FakeWindowPartContext();
    GitFixtures.answerWith(context, { ...GitFixtures.watching, "git.status": GitFixtures.status().toJson(), "git.graph": graph.toJson() });
    GitFixtures.setUp(context, [{ provide: WindowPartTokens.activeDocument, useValue: active }]);
    const fixture: ComponentFixture<GitHistoryComponent> = TestBed.createComponent(GitHistoryComponent);
    fixture.componentRef.setInput("instance", GitFixtures.folder);
    fixture.autoDetectChanges();
    await fixture.whenStable();
    const behind: number = context.callsOf("showView").length;

    active.set(true);
    await fixture.whenStable();
    active.set(false);
    await fixture.whenStable();
    active.set(true);
    await fixture.whenStable();

    expect([behind, context.callsOf("showView")]).toEqual([0, [["git.repository"], ["git.repository"]]]);
  });

  it("puts its repository first among the repositories opened lately when it opens, as a tab restored with the window or opened from the panel does", async () => {
    onTestFinished(() => GitRecentRepositories.forget(new Set(["/work/restored", "/work/earlier"])));
    GitRecentRepositories.remember("/work/restored");
    GitRecentRepositories.remember("/work/earlier");
    const context: FakeWindowPartContext = new FakeWindowPartContext();
    GitFixtures.answerWith(context, { ...GitFixtures.watching, "git.status": GitFixtures.status().toJson(), "git.graph": graph.toJson() });
    GitFixtures.setUp(context);
    const fixture: ComponentFixture<GitHistoryComponent> = TestBed.createComponent(GitHistoryComponent);
    fixture.componentRef.setInput("instance", "/work/restored");
    fixture.autoDetectChanges();
    await fixture.whenStable();

    expect(GitRecentRepositories.recent().slice(0, 2)).toEqual(["/work/restored", "/work/earlier"]);
  });

  it.each(AppearanceFixture.modes)("sets its columns edge to edge at any width, giving up columns as it narrows, with a line under the toolbar, in %s mode", async mode => {
    AppearanceFixture.apply(DefaultTheme.theme, mode);
    onTestFinished(() => AppearanceFixture.reset());
    const context: FakeWindowPartContext = new FakeWindowPartContext();
    GitFixtures.answerWith(context, { ...GitFixtures.watching, "git.status": GitFixtures.status().toJson(), "git.graph": graph.toJson() });
    GitFixtures.setUp(context);
    const fixture: ComponentFixture<GitHistoryComponent> = TestBed.createComponent(GitHistoryComponent);
    fixture.componentRef.setInput("instance", GitFixtures.folder);
    fixture.autoDetectChanges();
    const element: HTMLElement = fixture.nativeElement;
    element.style.height = "20rem";
    await untilAsync(element, () => element.querySelectorAll("[role=option]").length === 2);
    const abut = (selector: string): boolean => {
      const boxes: DOMRect[] = [...element.querySelectorAll(selector)].map(t => t.getBoundingClientRect()).filter(t => t.width > 0);
      return boxes.every((box, index) => index === 0 || Math.abs(box.left - (boxes[index - 1]?.right ?? 0)) < 0.5);
    };
    const measure = (width: string): readonly [number, boolean] => {
      element.style.width = width;
      return [[...element.querySelectorAll(".header > .cell")].filter(t => t.getBoundingClientRect().width > 0).length, abut(".header > .cell")];
    };

    expect([measure("80rem"), measure("50rem"), measure("30rem")]).toEqual([[5, true], [5, true], [3, true]]);
    const toolbar: HTMLElement = element.querySelector<HTMLElement>(".toolbar") ?? element;
    const probe: HTMLSpanElement = document.createElement("span");
    probe.style.color = "var(--nol-border)";
    toolbar.append(probe);
    expect([getComputedStyle(toolbar).borderBottomWidth, getComputedStyle(toolbar).borderBottomColor, toolbar.getBoundingClientRect().height
      / parseFloat(getComputedStyle(document.documentElement).fontSize)]).toEqual(["1px", getComputedStyle(probe).color, 2.25]);
    probe.remove();
  });

  it("draws its toolbars as one kit toolbar, labeled while wide, moving toolbars that don't fit into a More menu that runs them, nothing overlapping", async () => {
    const context: FakeWindowPartContext = new FakeWindowPartContext();
    GitFixtures.answerWith(context, {
      ...GitFixtures.watching, "git.push": null, "git.status": GitFixtures.status([], new StatusUpstream("origin/main", 2, 0, false)).toJson(), "git.graph": graph.toJson()
    });
    GitFixtures.setUp(context);
    const fixture: ComponentFixture<GitHistoryComponent> = TestBed.createComponent(GitHistoryComponent);
    fixture.componentRef.setInput("instance", GitFixtures.folder);
    fixture.autoDetectChanges();
    const element: HTMLElement = fixture.nativeElement;
    element.style.height = "20rem";
    const rem = (pixels: number): number => pixels / parseFloat(getComputedStyle(document.documentElement).fontSize);
    const box = (selector: string): DOMRect => element.querySelector(selector)?.getBoundingClientRect() ?? new DOMRect();
    const groups = (): readonly string[] => [...element.querySelectorAll(".group")].map(t => t.getAttribute("aria-label") ?? "");
    const labeled = (): boolean => box("[data-action=UndoCommit]").width > 1.5 * box("[data-action=UndoCommit]").height;
    const layoutAsync = async (width: string, fits: (count: number) => boolean, isLabeled: boolean): Promise<readonly [readonly string[], boolean, boolean, boolean]> => {
      element.style.width = width;
      await untilAsync(element, () => fits(groups().length) && (!Object.isNull(element.querySelector(".more"))) === groups().length < 4 && labeled() === isLabeled);
      const ends: readonly DOMRect[] = [...element.querySelectorAll(".actions > *")].map(t => t.getBoundingClientRect());
      const last: DOMRect = ends[ends.length - 1] ?? new DOMRect();
      return [
        groups(),
        !Object.isNull(element.querySelector(".more")),
        ends.every((t, index) => index === 0 || t.left >= (ends[index - 1]?.right ?? 0)),
        rem(box(".field").left - last.right) >= 0.25 && rem(box(".toolbar").right - box(".field").right) === 0.5
      ];
    };
    const unavailable = (action: string): boolean => element.querySelector(`.actions [data-action="${action}"]`)?.getAttribute("aria-disabled") === "true";
    await untilAsync(element, () => !unavailable("Push"));
    const all = (count: number): boolean => count === 4;
    const wide = await layoutAsync("80rem", all, true);
    const widths: readonly number[] = [rem(box("[data-action=Pull]").width), rem(box("[data-action=Pull]").height)];
    const middle = await layoutAsync("40rem", all, false);
    const iconWidths: readonly number[] = [rem(box("[data-action=Pull]").width), rem(box("[data-action=Fetch]").width)];
    const redo: Element | null = element.querySelector("[data-action=Redo]");
    const narrow = await layoutAsync("14rem", count => count === 1, false);
    const before: number = context.callsOf("requestAsync").filter(t => t[0] === "git.push").length;
    element.querySelector<HTMLElement>(".more")?.click();
    await untilAsync(document.body, () => document.querySelectorAll("button[nol-menu-item]").length > 0);
    const items: readonly (readonly [string | null, boolean])[] = [...document.querySelectorAll<HTMLButtonElement>("button[nol-menu-item]")]
      .map(t => [t.getAttribute("data-action"), t.getAttribute("aria-disabled") === "true"]);
    document.querySelector<HTMLElement>("button[nol-menu-item][data-action=Push]")?.click();
    await GitFixtures.untilAsync(() => context.callsOf("requestAsync").filter(t => t[0] === "git.push").length > before);
    const wider = await layoutAsync("80rem", all, true);

    expect([element.querySelector(".actions")?.getAttribute("role"), element.querySelector(".actions")?.getAttribute("aria-label")]).toEqual(["toolbar", "History actions"]);
    expect(wide).toEqual([["Undo", "Sync", "Branch", "Terminal"], false, true, true]);
    expect(widths[0]).toBeGreaterThan(widths[1] ?? 0);
    expect(middle).toEqual([["Undo", "Sync", "Branch", "Terminal"], false, true, true]);
    expect([iconWidths[0], redo]).toEqual([iconWidths[1], null]);
    expect(narrow).toEqual([["Undo"], true, true, true]);
    expect(items).toEqual([["Fetch", false], ["Pull", false], ["Push", false], ["Branch", false], ["Stash", true], ["Terminal", false]]);
    expect(context.callsOf("requestAsync").filter(t => t[0] === "git.push").map(t => t[1])).toEqual([{ folder: GitFixtures.folder, basedOn: "f1" }]);
    expect(wider).toEqual([["Undo", "Sync", "Branch", "Terminal"], false, true, true]);
    expect([element.querySelector("[data-action=Push]")?.getAttribute("aria-label"), unavailable("Fetch"), unavailable("Stash")]).toEqual(["Push 2", false, true]);
  });

  it("draws about 40 rows past the view, so a fast scroll finds them drawn", async () => {
    const many: GitGraph = new GitGraph(Array.from({ length: 200 }, (_, index) => new GitGraphCommit(
      new GitCommit(index.toString(16).padStart(40, "0"), index === 199 ? [] : [(index + 1).toString(16).padStart(40, "0")], "Sample Author", "2026-11-06T17:30:00Z",
        `Commit ${index}`), "author@example.com", index === 0 ? [new GitRef(RefKind.Head, "main"), new GitRef(RefKind.Branch, "main")] : [])), false);
    const context: FakeWindowPartContext = new FakeWindowPartContext();
    GitFixtures.answerWith(context, { ...GitFixtures.watching, "git.status": GitFixtures.status().toJson(), "git.graph": many.toJson() });
    GitFixtures.setUp(context);
    const fixture: ComponentFixture<GitHistoryComponent> = TestBed.createComponent(GitHistoryComponent);
    fixture.componentRef.setInput("instance", GitFixtures.folder);
    fixture.autoDetectChanges();
    const element: HTMLElement = fixture.nativeElement;
    element.style.height = "20rem";
    await untilAsync(element, () => element.querySelectorAll("[role=option]").length > 30);

    expect(element.querySelectorAll("[role=option]").length).toBeGreaterThanOrEqual(50);
  });
});

