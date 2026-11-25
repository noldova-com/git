/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ErrorHandler, signal, type WritableSignal } from "@angular/core";
import { type ComponentFixture, TestBed } from "@angular/core/testing";
import { By } from "@angular/platform-browser";
import "@noldova/context.core";
import { WindowPartTokens } from "@noldova/desktop.window";
import { FakeWindowPartContext } from "@noldova/desktop.window/testing";
import {
  ConflictKind, FailureCode, FileState, GitOperation, GitRebaseCheck, GitRebaseCommit, GitRebasePlan, GitRebaseStepCheck, type JsonValue, OperationKind, RebaseCheckOutcome
} from "@noldova/git.protocol";
import { LinkReferenceMatch, SelectComponent } from "@noldova/ui.components.angular";
import { describe, expect, it, onTestFinished, vi } from "vitest";

import { GitRebaseComponent } from "../../../../src/app/components/git-rebase/git-rebase.component.ts";
import { GitRebasePreviewComponent } from "../../../../src/app/components/git-rebase-preview/git-rebase-preview.component.ts";
import { GitFolder } from "../../../../src/app/services/git-folder.ts";
import { GitLinkReferences } from "../../../../src/app/services/git-link-references.ts";
import { GitRebaseTarget, GitRebasing } from "../../../../src/app/services/git-rebasing.ts";
import { GitResolving } from "../../../../src/app/services/git-resolving.ts";
import { GitRuntimeClient } from "../../../../src/app/services/git-runtime-client.ts";
import { GitViewOptions } from "../../../../src/app/services/git-view-options.ts";
import { GitFixtures } from "../../../fixtures/git-fixtures.fixture.ts";
import { GitHeldRequests } from "../../../fixtures/git-held-requests.fixture.ts";

describe("GitRebaseComponent", () => {
  const onto: string = "0".repeat(40);
  const base: string = "b".repeat(40);
  const a: GitRebaseCommit = new GitRebaseCommit("a".repeat(40), "Read the log as a stream\n\nBody.", null);
  const c: GitRebaseCommit = new GitRebaseCommit("c".repeat(40), "Draw lanes on a canvas", null);
  const fix: GitRebaseCommit = new GitRebaseCommit("f".repeat(40), "fixup! Read the log as a stream", a.id);
  const wip: GitRebaseCommit = new GitRebaseCommit("e".repeat(40), "WIP debug logging", null);
  const plan: GitRebasePlan = new GitRebasePlan("feature/graph", onto, base, 4, [a, c, fix, wip], ["feature/minimap"], true);
  /** The status's branch and commit the plan was read for. */
  const onPlan = { branch: "feature/graph", head: wip.id } as const;
  const target: GitRebaseTarget = new GitRebaseTarget(onto, "main");
  const clean: GitRebaseStepCheck = new GitRebaseStepCheck(RebaseCheckOutcome.Clean, []);

  type Answers = Readonly<Record<string, JsonValue | Error | (() => JsonValue | Error)>>;

  class Screen {
    public readonly context: FakeWindowPartContext;
    public readonly fixture: ComponentFixture<GitRebaseComponent>;
    /** The Rebase preview view beside the document, which shows its preview while it is in front. */
    public readonly view: ComponentFixture<GitRebasePreviewComponent>;
    public readonly held: GitHeldRequests;
    /** Whether the screen's document is the window's active one, which points the Git panel at its folder. */
    public readonly active: WritableSignal<boolean>;

    public constructor(context: FakeWindowPartContext, fixture: ComponentFixture<GitRebaseComponent>, view: ComponentFixture<GitRebasePreviewComponent>,
      held: GitHeldRequests, active: WritableSignal<boolean>) {
      this.context = context;
      this.fixture = fixture;
      this.view = view;
      this.held = held;
      this.active = active;
    }

    public get element(): HTMLElement {
      return this.fixture.nativeElement;
    }

    public get viewElement(): HTMLElement {
      return this.view.nativeElement;
    }

    public static render(answers: Answers, opened: GitRebaseTarget | null = target, held: readonly string[] = []): Screen {
      const context: FakeWindowPartContext = new FakeWindowPartContext();
      const requests: GitHeldRequests = new GitHeldRequests(context, held, {
        ...GitFixtures.watching, "git.status": GitFixtures.status([], null, { fingerprint: "f1", ...onPlan }).toJson(), ...answers
      });
      const active: WritableSignal<boolean> = signal(true);
      GitFixtures.setUp(context, [{ provide: WindowPartTokens.activeDocument, useValue: active }]);
      onTestFinished(() => GitRebasing.targets.set(new Map()));
      if (!Object.isNull(opened))
        GitRebasing.open(GitFixtures.folder, opened);
      const fixture: ComponentFixture<GitRebaseComponent> = TestBed.createComponent(GitRebaseComponent);
      fixture.componentRef.setInput("instance", GitFixtures.folder);
      fixture.autoDetectChanges();
      const view: ComponentFixture<GitRebasePreviewComponent> = TestBed.createComponent(GitRebasePreviewComponent);
      view.componentRef.setInput("instance", "selected");
      view.autoDetectChanges();
      // TestBed takes the earlier fixtures' root elements out of the page as it creates a component, so the document goes back beside the view.
      document.body.append(fixture.nativeElement);
      return new Screen(context, fixture, view, requests, active);
    }

    /** The matches in the document, then in the Rebase preview view, as the window shows them side by side. */
    public all<T extends Element = Element>(selector: string): readonly T[] {
      return [...this.element.querySelectorAll<T>(selector), ...this.viewElement.querySelectorAll<T>(selector)];
    }

    public texts(selector: string): readonly string[] {
      return this.all(selector).map(t => (t.textContent ?? "").replace(/\s+/gu, " ").trim());
    }

    /** Each match's text, its child elements' texts joined by spaces as a reader hears them. */
    public words(selector: string): readonly string[] {
      return this.all(selector).map(t => t.children.length === 0 ? (t.textContent ?? "").trim()
        : [...t.children].map(child => (child.textContent ?? "").trim()).filter(text => text.length > 0).join(" "));
    }

    public find<T extends HTMLElement = HTMLElement>(selector: string): T {
      const [found] = this.all<T>(selector);
      if (Object.isUndefined(found))
        throw new Error(`Nothing matches ${selector}.`);
      return found;
    }

    public row(index: number): HTMLElement {
      return this.find(`[data-row="${index}"]`);
    }

    public ids(): readonly string[] {
      return this.texts(".steps .step:not(.lift) .id");
    }

    public requested(method: string): readonly unknown[] {
      return this.context.callsOf("requestAsync").filter(t => t[0] === method).map(t => t[1]);
    }

    public key(index: number, key: string, options: KeyboardEventInit = {}): void {
      this.row(index).dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true, ...options }));
      this.fixture.detectChanges();
    }

    public async readyAsync(): Promise<void> {
      await vi.waitUntil(() => this.texts(".check-text").length > 0 && !this.texts(".check-text").includes("Checking…"));
      await this.view.whenStable();
    }
  }

  const checks = (...outcomes: readonly GitRebaseStepCheck[]): JsonValue => new GitRebaseCheck(outcomes).toJson();
  const rem = (pixels: number): number => pixels / Number.parseFloat(getComputedStyle(document.documentElement).fontSize);

  it("lists the branch's commits with fixups folded under their targets, each checked, and previews the branch before and after", async () => {
    const screen: Screen = Screen.render({
      "git.rebasePlan": plan.toJson(),
      "git.rebaseCheck": checks(clean, new GitRebaseStepCheck(RebaseCheckOutcome.Folded, []), new GitRebaseStepCheck(RebaseCheckOutcome.Conflicts, ["lanes.ts"]),
        new GitRebaseStepCheck(RebaseCheckOutcome.Clean, []))
    });
    await screen.readyAsync();

    expect(screen.texts(".title")).toEqual(["Rebase four commits of feature/graph onto main"]);
    expect(screen.ids()).toEqual(["aaaaaaa", "fffffff", "ccccccc", "eeeeeee"]);
    expect(screen.texts(".steps .message")).toEqual(["Read the log as a stream", "fixup! Read the log as a stream", "Draw lanes on a canvas", "WIP debug logging"]);
    expect([...screen.element.querySelectorAll(".steps .step")].map(t => t.classList.contains("folded"))).toEqual([false, true, false, false]);
    expect(screen.texts(".check-text")).toEqual(["Applies cleanly", "Folds into aaaaaaa", "Conflicts in lanes.ts", "Applies cleanly"]);
    expect(screen.texts(".summary")).toEqual(["4 commits become 3"]);
    expect(screen.texts(".option-note")).toEqual(["feature/minimap follows", "stops at the first commit that fails"]);
    expect(screen.words(".now .node")).toEqual(["feature/graph", "4 commits from bbbbbbb", "main 4 commits ahead of the base"]);
    expect(screen.words(".after .node")).toEqual(["feature/minimap moved too", "feature/graph", "WIP debug logging", "Draw lanes on a canvas", "Read the log as a stream",
      "main 0000000"]);
    expect(screen.words(".stop-title")).toEqual(["warning Step 3 will stop on a conflict"]);
    expect(screen.texts(".stop-text")).toEqual(["lanes.ts changed on main. The same lines change in ccccccc. You can resolve it when the rebase stops, or move or drop this commit."]);
    expect(screen.texts(".pushed")).toEqual(["The branch has been pushed. After the rebase, Push will offer a force push with lease, which refuses if someone else pushed meanwhile."]);
    expect(screen.requested("git.rebasePlan")).toEqual([{ folder: GitFixtures.folder, onto }]);
    expect(screen.requested("git.rebaseCheck").at(0)).toEqual({
      folder: GitFixtures.folder, onto,
      steps: [{ id: a.id, action: "Pick", message: null }, { id: fix.id, action: "Fixup", message: null }, { id: c.id, action: "Pick", message: null },
        { id: wip.id, action: "Pick", message: null }]
    });
  });

  it("shows the references a host finds in a step's subject and in the branch after, out of the rows' tab order, and opens one without selecting its row", async () => {
    const opened: string[] = [];
    onTestFinished(GitLinkReferences.provide({
      referencesFor: () => ({ find: () => null, findText: t => t.startsWith("Draw lanes") ? [new LinkReferenceMatch(5, 5, "https://example.com/issues/5")] : [] }),
      opens: (_folder, url) => opened.push(url) > 0
    }));
    const screen: Screen = Screen.render({ "git.rebasePlan": plan.toJson(), "git.rebaseCheck": checks(clean, clean, clean, clean) });
    await screen.readyAsync();
    const link: HTMLAnchorElement = screen.find<HTMLAnchorElement>("[data-row=\"2\"] .message a");
    const selected: string | null = screen.find(".step.selected").getAttribute("data-row");

    link.click();
    screen.fixture.detectChanges();

    expect([link.textContent, link.getAttribute("tabindex"), opened, selected === "2", screen.find(".step.selected").getAttribute("data-row") === selected])
      .toEqual(["lanes", "-1", ["https://example.com/issues/5"], false, true]);
    expect(screen.texts(".after .result a")).toEqual(["lanes"]);
  });

  it("sets its one panel right under the title bar, with 0.25rem at the sides and the bottom, leaving the preview to its view", async () => {
    const screen: Screen = Screen.render({ "git.rebasePlan": plan.toJson(), "git.rebaseCheck": checks(clean, clean, clean, clean) });
    screen.element.style.height = "30rem";
    await screen.readyAsync();
    const host: DOMRect = screen.element.getBoundingClientRect();
    const panels: DOMRect[] = [...screen.element.querySelectorAll(":scope > .layout > .panel")].map(t => t.getBoundingClientRect());
    const first: DOMRect = panels[0] ?? host;
    const last: DOMRect = panels.at(-1) ?? host;

    expect([panels.length, rem(first.top - host.top), rem(first.left - host.left), rem(host.right - last.right), rem(host.bottom - first.bottom)])
      .toEqual([1, 0, 0.25, 0.25, 0.25]);
  });

  it("opens the Rebase preview view once its plan reads in front, keeps the preview while a document of another kind is, giving the tab back and taking it again, and empties once it closes", async () => {
    const screen: Screen = Screen.render({ "git.rebasePlan": plan.toJson(), "git.rebaseCheck": () => checks(clean, clean, clean, clean) });
    const empty = (): readonly string[] => screen.texts(".empty-view");
    await screen.readyAsync();
    const front: readonly string[] = [...empty(), ...screen.words(".now .node").slice(0, 1)];

    screen.active.set(false);
    screen.view.detectChanges();
    const behind: readonly string[] = [...empty(), ...screen.words(".now .node").slice(0, 1)];
    screen.active.set(true);
    screen.view.detectChanges();
    screen.fixture.destroy();
    screen.view.detectChanges();

    const opened: readonly unknown[] = ["git.rebasePreview", "selected", "Rebase preview"];
    expect([front, behind, empty(), screen.context.callsOf("openView"), screen.context.callsOf("returnView"), screen.context.callsOf("showView")])
      .toEqual([["feature/graph"], ["feature/graph"], ["Open an interactive rebase to preview it."], [opened, opened], [["git.rebasePreview", "selected"]], []]);
  });

  it("sets a row's action by its key, moves it with Alt+the arrows, moves the selection with the arrows, and leaves keys with modifiers alone", async () => {
    const screen: Screen = Screen.render({ "git.rebasePlan": plan.toJson(), "git.rebaseCheck": () => checks(clean, clean, clean, clean) });
    await screen.readyAsync();

    screen.key(3, "d");
    screen.key(2, "ArrowUp", { altKey: true });
    screen.key(2, "ArrowDown");
    screen.key(3, "ArrowDown");
    screen.key(0, "ArrowUp", { altKey: true });
    screen.key(1, "e", { ctrlKey: true });
    screen.key(1, "Enter");
    await screen.readyAsync();

    expect(screen.ids()).toEqual(["aaaaaaa", "ccccccc", "fffffff", "eeeeeee"]);
    expect(screen.texts(".steps .step.selected .id")).toEqual(["eeeeeee"]);
    expect(screen.texts(".check-text").at(-1)).toBe("Left out");
    expect(screen.find(".steps .step.dropped .message").textContent).toBe("WIP debug logging");
    expect(screen.texts(".summary")).toEqual(["4 commits become 2"]);
    expect(screen.texts(".after .node.result")).toEqual(["Draw lanes on a canvas", "Read the log as a stream"]);
  });

  it("keeps the focus on a row moved with Alt+the arrows once it is drawn in its new place", async () => {
    const screen: Screen = Screen.render({ "git.rebasePlan": plan.toJson(), "git.rebaseCheck": () => checks(clean, clean, clean, clean) });
    await screen.readyAsync();
    const before: readonly string[] = screen.ids();

    screen.key(3, "ArrowUp", { altKey: true });
    await screen.readyAsync();

    expect(document.activeElement?.closest(".step")?.querySelector(".id")?.textContent).toBe(before[3]);
    expect(screen.ids()[2]).toBe(before[3]);
  });

  it("refuses a first kept row that folds, holding Start, and checks nothing until the rows can run", async () => {
    const screen: Screen = Screen.render({ "git.rebasePlan": plan.toJson(), "git.rebaseCheck": () => checks(clean, clean, clean, clean) });
    await screen.readyAsync();
    const asked: number = screen.requested("git.rebaseCheck").length;

    screen.key(0, "s");

    expect(screen.texts(".options .failure")).toEqual(["The first kept commit can't be squashed or fixed up, since there's nothing before it to fold into."]);
    expect(screen.find<HTMLButtonElement>(".start").disabled).toBe(true);
    expect(screen.requested("git.rebaseCheck").length).toBe(asked);
  });

  it("rewords the selected row in its field, then starts the rebase with the steps, the stacked branches and the status's fingerprint, and closes", async () => {
    const screen: Screen = Screen.render({ "git.rebasePlan": plan.toJson(), "git.rebaseCheck": () => checks(clean, clean, clean, clean), "git.rebase": null });
    await screen.readyAsync();

    screen.key(0, "r");
    await screen.fixture.whenStable();
    const field: HTMLInputElement = screen.find<HTMLInputElement>(".message-field");
    expect(field.value).toBe("Read the log as a stream");
    field.value = "Read git log as a stream";
    field.dispatchEvent(new Event("input"));
    field.dispatchEvent(new KeyboardEvent("keydown", { key: "d", bubbles: true }));
    screen.find<HTMLButtonElement>(".start").click();
    await vi.waitUntil(() => screen.context.callsOf("closeDocument").length > 0);

    expect(screen.requested("git.rebase")).toEqual([{
      folder: GitFixtures.folder, onto, updateRefs: true, basedOn: "f1",
      steps: [{ id: a.id, action: "Reword", message: "Read git log as a stream\n\nBody." }, { id: fix.id, action: "Fixup", message: null }, { id: c.id, action: "Pick", message: null },
        { id: wip.id, action: "Pick", message: null }]
    }]);
    expect(screen.context.callsOf("closeDocument")).toEqual([["git.interactiveRebase", GitFixtures.folder]]);
    expect(GitRebasing.targetOf(GitFixtures.folder)).toBeNull();
  });

  it("squashes with the group's messages joined by default, and moves no stacked branch once that option is off", async () => {
    const screen: Screen = Screen.render({ "git.rebasePlan": plan.toJson(), "git.rebaseCheck": () => checks(clean, clean, clean, clean), "git.rebase": null });
    await screen.readyAsync();

    screen.key(2, "s");
    screen.find<HTMLInputElement>(".move-stacked input").click();
    screen.fixture.detectChanges();
    expect(screen.words(".after .node")).toEqual(["feature/graph", "WIP debug logging", "Read the log as a stream", "main 0000000"]);
    screen.find<HTMLButtonElement>(".start").click();
    await vi.waitUntil(() => screen.requested("git.rebase").length > 0);

    expect(screen.requested("git.rebase")).toEqual([expect.objectContaining({
      updateRefs: false,
      steps: [{ id: a.id, action: "Pick", message: null }, { id: fix.id, action: "Fixup", message: null },
        { id: c.id, action: "Squash", message: "Read the log as a stream\n\nBody.\n\nDraw lanes on a canvas" }, { id: wip.id, action: "Pick", message: null }]
    })]);
  });

  it("keeps the commits in their own order, all picked, while folding is off", async () => {
    const screen: Screen = Screen.render({ "git.rebasePlan": plan.toJson(), "git.rebaseCheck": () => checks(clean, clean, clean, clean) });
    await screen.readyAsync();

    screen.find<HTMLInputElement>(".fold-fixups input").click();
    await vi.waitUntil(() => screen.ids()[1] === "ccccccc");

    expect(screen.ids()).toEqual(["aaaaaaa", "ccccccc", "fffffff", "eeeeeee"]);
    expect(screen.texts(".summary")).toEqual(["4 commits become 4"]);
  });

  it("keeps the undo option checked and locked, saying Undo puts a finished rebase back and Abort a stopped one, with no checkpoint promised", async () => {
    const screen: Screen = Screen.render({ "git.rebasePlan": plan.toJson(), "git.rebaseCheck": () => checks(clean, clean, clean, clean) });
    await screen.readyAsync();
    const box: HTMLInputElement = screen.find<HTMLInputElement>(".undo-back input");

    box.click();
    screen.fixture.detectChanges();

    expect([box.checked, box.getAttribute("aria-disabled") === "true", ...screen.texts(".undo-back"), screen.find(".undo-back").closest(".option")?.getAttribute("title")])
      .toEqual([true, true, "Undo puts the branch back as it was, once the rebase finishes",
        "Always on: a finished rebase is in the Undo menu, which puts the branch and the stacked branches it moved back where they were. A rebase that stops on a conflict goes back with Abort rebase."]);
    expect(screen.element.textContent).not.toMatch(/checkpoint|Ctrl\+Z/iu);
  });

  it("moves a dragged row into the gap it is dropped on, marking that gap while it drags", async () => {
    const screen: Screen = Screen.render({ "git.rebasePlan": plan.toJson(), "git.rebaseCheck": () => checks(clean, clean, clean, clean) });
    await screen.readyAsync();
    const over = (index: number, lower: boolean): void => {
      const box: DOMRect = screen.row(index).getBoundingClientRect();
      screen.row(index).dispatchEvent(new DragEvent("dragover", { bubbles: true, cancelable: true, clientY: lower ? box.bottom - 2 : box.top + 2 }));
      screen.fixture.detectChanges();
    };

    over(1, true);
    expect(screen.element.querySelectorAll(".drop-line").length).toBe(0);
    screen.row(0).dispatchEvent(new DragEvent("dragstart", { bubbles: true, dataTransfer: new DataTransfer() }));
    over(3, true);
    expect([screen.element.querySelectorAll(".drop-line").length, screen.row(0).classList.contains("lifted")]).toEqual([1, true]);
    over(2, false);
    screen.row(2).dispatchEvent(new DragEvent("drop", { bubbles: true, cancelable: true }));
    screen.fixture.detectChanges();

    expect(screen.ids()).toEqual(["fffffff", "aaaaaaa", "ccccccc", "eeeeeee"]);
    expect(screen.element.querySelectorAll(".drop-line, .lifted").length).toBe(0);
    screen.row(3).dispatchEvent(new DragEvent("dragstart", { bubbles: true }));
    over(0, true);
    screen.row(1).dispatchEvent(new DragEvent("drop", { bubbles: true, cancelable: true }));
    screen.fixture.detectChanges();
    expect(screen.ids()).toEqual(["fffffff", "eeeeeee", "aaaaaaa", "ccccccc"]);
    screen.row(3).dispatchEvent(new DragEvent("dragstart", { bubbles: true }));
    over(0, false);
    screen.row(3).dispatchEvent(new DragEvent("dragend", { bubbles: true }));
    screen.find(".steps").dispatchEvent(new DragEvent("drop", { bubbles: true, cancelable: true }));
    screen.fixture.detectChanges();
    expect(screen.ids()).toEqual(["fffffff", "eeeeeee", "aaaaaaa", "ccccccc"]);
  });

  it("floats the dragged row as a card from the first move over the steps, keeping the point it was taken by under the pointer, and drops it on drop or drag end",
    async () => {
      const screen: Screen = Screen.render({ "git.rebasePlan": plan.toJson(), "git.rebaseCheck": () => checks(clean, clean, clean, clean) });
      await screen.readyAsync();
      const steps: HTMLElement = screen.find(".steps");
      const cards = (): readonly string[] => [...steps.querySelectorAll<HTMLElement>(".lift")].map(t => t.querySelector(".id")?.textContent ?? "");
      const move = (clientY: number): void => {
        steps.dispatchEvent(new DragEvent("dragover", { bubbles: true, cancelable: true, clientY }));
        screen.fixture.detectChanges();
      };
      const taken: DOMRect = screen.row(1).getBoundingClientRect();
      const lifted: string = screen.ids()[1] ?? "";
      move(taken.top + 5);
      const idle: readonly string[] = cards();
      const transfer: DataTransfer = new DataTransfer();
      const pictures: unknown[] = [];
      vi.spyOn(transfer, "setDragImage").mockImplementation((image, x, y) => pictures.push([image instanceof HTMLImageElement ? image.src : null, x, y]));
      screen.row(1).dispatchEvent(new DragEvent("dragstart", { bubbles: true, clientY: taken.top + 5, dataTransfer: transfer }));
      screen.fixture.detectChanges();
      const before: readonly string[] = cards();
      const target: number = screen.row(3).getBoundingClientRect().top;
      move(target + 5);
      const card: HTMLElement = screen.find(".lift");

      expect([idle, before, cards(), Math.round(card.offsetTop - screen.row(3).offsetTop), screen.row(1).classList.contains("lifted")])
        .toEqual([[], [], [lifted], 0, true]);
      expect(pictures).toEqual([["data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7", 0, 0]]);
      steps.dispatchEvent(new DragEvent("drop", { bubbles: true, cancelable: true }));
      screen.fixture.detectChanges();
      expect(cards()).toEqual([]);
      screen.row(0).dispatchEvent(new DragEvent("dragstart", { bubbles: true }));
      move(target);
      const again: readonly string[] = cards();
      screen.row(0).dispatchEvent(new DragEvent("dragend", { bubbles: true }));
      screen.fixture.detectChanges();
      expect([again, cards()]).toEqual([[screen.ids()[0]], []]);
    });

  it("checks the dragged row where it would drop, on its card, keeping only the latest gap's answer and refusing a gap that puts a fold first", async () => {
    const screen: Screen = Screen.render({ "git.rebasePlan": plan.toJson() }, target, ["git.rebaseCheck"]);
    (await screen.held.nextAsync("git.rebaseCheck"))(checks(clean, clean, clean, clean));
    await screen.readyAsync();
    const card = (): readonly string[] => screen.texts(".lift .check-text");
    const over = (index: number, lower: boolean): void => {
      const box: DOMRect = screen.row(index).getBoundingClientRect();
      screen.row(index).dispatchEvent(new DragEvent("dragover", { bubbles: true, cancelable: true, clientY: lower ? box.bottom - 2 : box.top + 2 }));
      screen.fixture.detectChanges();
    };

    screen.row(2).dispatchEvent(new DragEvent("dragstart", { bubbles: true }));
    over(3, true);
    const checking: readonly string[] = card();
    const below: (answer: JsonValue | Error) => void = await screen.held.nextAsync("git.rebaseCheck");
    const asked: unknown = screen.requested("git.rebaseCheck").at(-1);
    below(checks(clean, new GitRebaseStepCheck(RebaseCheckOutcome.Folded, []), clean, new GitRebaseStepCheck(RebaseCheckOutcome.Conflicts, ["lanes.ts"])));
    await vi.waitUntil(() => card()[0] !== "Dropped here: checking…");
    const conflicted: readonly string[] = card();
    over(0, false);
    const top: (answer: JsonValue | Error) => void = await screen.held.nextAsync("git.rebaseCheck");
    over(2, false);
    const home: readonly string[] = card();
    top(checks(new GitRebaseStepCheck(RebaseCheckOutcome.Conflicts, ["graph.ts"]), clean, clean, clean));
    await screen.fixture.whenStable();
    const stale: readonly string[] = card();
    const count: number = screen.requested("git.rebaseCheck").length;
    screen.row(2).dispatchEvent(new DragEvent("dragend", { bubbles: true }));
    screen.row(0).dispatchEvent(new DragEvent("dragstart", { bubbles: true }));
    over(3, true);

    expect([checking, conflicted, home, stale]).toEqual([["Dropped here: checking…"], ["Dropped here: conflicts in lanes.ts"], ["Dropped here: clean"], ["Dropped here: clean"]]);
    expect(asked).toEqual({
      folder: GitFixtures.folder, onto,
      steps: [{ id: a.id, action: "Pick", message: null }, { id: fix.id, action: "Fixup", message: null }, { id: wip.id, action: "Pick", message: null },
        { id: c.id, action: "Pick", message: null }]
    });
    expect([card(), screen.requested("git.rebaseCheck").length]).toEqual([["Dropped here: nothing before it to fold into"], count]);
  });

  describe("advice after the summary", () => {
    const conflict: GitRebaseStepCheck = new GitRebaseStepCheck(RebaseCheckOutcome.Conflicts, ["lanes.ts"]);
    /** The commits' ids in the order a check asked for them. */
    const order = (asked: unknown, commits: readonly GitRebaseCommit[] = [a, c, fix, wip]): readonly string[] => {
      const text: string = JSON.stringify(asked);
      return commits.map(t => t.id).filter(t => text.includes(t)).sort((x, y) => text.indexOf(x) - text.indexOf(y));
    };
    /** Answers each check with the conflicted commit's conflict, unless its place clears it. */
    const answerFor = (screen: () => Screen, conflicted: string, clears: (ids: readonly string[]) => boolean) => (): JsonValue => {
      const ids: readonly string[] = order(screen().requested("git.rebaseCheck").at(-1));
      return checks(...ids.map(t => t === conflicted && !clears(ids) ? conflict : clean));
    };

    it.each([
      { name: "below the fixup", conflicted: wip.id, clears: (ids: readonly string[]): boolean => ids.indexOf(wip.id) === 2,
        summary: "4 commits become 3 · dropping eeeeeee below the fixup clears the conflict in lanes.ts", places: ["afce", "afec"] },
      { name: "below a commit", conflicted: c.id, clears: (ids: readonly string[]): boolean => ids.indexOf(c.id) === 3,
        summary: "4 commits become 3 · dropping ccccccc below eeeeeee clears the conflict in lanes.ts", places: ["afce", "afec"] },
      { name: "at the top, skipping the place above the fixup", conflicted: c.id, clears: (ids: readonly string[]): boolean => ids[0] === c.id,
        summary: "4 commits become 3 · dropping ccccccc to the top clears the conflict in lanes.ts", places: ["afce", "afec", "cafe"] }
    ])("names the nearest place that clears the conflicting row's conflict, $name", async ({ conflicted, clears, summary, places }) => {
      const screen: Screen = Screen.render({ "git.rebasePlan": plan.toJson(), "git.rebaseCheck": answerFor(() => screen, conflicted, clears) });
      await vi.waitUntil(() => screen.texts(".summary")[0]?.includes("·") === true, { timeout: 5000 });

      expect(screen.texts(".summary")).toEqual([summary]);
      expect(screen.requested("git.rebaseCheck").map(t => order(t).map(id => id.slice(0, 1)).join(""))).toEqual(places);
    });

    it("gives none for a conflicting fixup, which every move would fold elsewhere", async () => {
      const screen: Screen = Screen.render({ "git.rebasePlan": plan.toJson(), "git.rebaseCheck": checks(clean, conflict, clean, clean) });
      await screen.readyAsync();

      expect([screen.requested("git.rebaseCheck").length, ...screen.texts(".summary")]).toEqual([1, "4 commits become 3"]);
    });

    it("tries the place below before the place as far above", async () => {
      const commits: readonly GitRebaseCommit[] = Array.from({ length: 5 }, (_, index) => new GitRebaseCommit(String(index + 1).repeat(40), `Commit ${index}`, null));
      const middle: string = commits[2]?.id ?? "";
      const screen: Screen = Screen.render({
        "git.rebasePlan": new GitRebasePlan("feature/graph", onto, base, 0, commits, [], false).toJson(),
        "git.rebaseCheck": () => {
          const ids: readonly string[] = order(screen.requested("git.rebaseCheck").at(-1), commits);
          return checks(...ids.map(t => t === middle && ids.indexOf(middle) === 2 ? conflict : clean));
        }
      });
      await vi.waitUntil(() => screen.texts(".summary")[0]?.includes("·") === true, { timeout: 5000 });

      expect([screen.requested("git.rebaseCheck").length, ...screen.texts(".summary")])
        .toEqual([2, "5 commits become 5 · dropping 3333333 below 4444444 clears the conflict in lanes.ts"]);
    });

    it("tries only the 20 nearest places", async () => {
      const commits: readonly GitRebaseCommit[] = Array.from({ length: 23 }, (_, index) => new GitRebaseCommit(String(index + 10).repeat(20), `Commit ${index}`, null));
      const last: string = commits[22]?.id ?? "";
      const screen: Screen = Screen.render({
        "git.rebasePlan": new GitRebasePlan("feature/graph", onto, base, 0, commits, [], false).toJson(),
        "git.rebaseCheck": () => {
          const ids: readonly string[] = order(screen.requested("git.rebaseCheck").at(-1), commits);
          return checks(...ids.map(t => t === last && ids[0] !== last ? conflict : clean));
        }
      });
      await vi.waitUntil(() => screen.requested("git.rebaseCheck").length >= 21, { timeout: 5000 });
      await screen.fixture.whenStable();

      expect([screen.requested("git.rebaseCheck").length, ...screen.texts(".summary")]).toEqual([21, "23 commits become 23"]);
    });

    it("stops once a check of a place fails", async () => {
      let calls: number = 0;
      const screen: Screen = Screen.render({
        "git.rebasePlan": plan.toJson(), "git.rebaseCheck": () => ++calls === 1 ? checks(clean, clean, conflict, clean) : GitFixtures.failure(FailureCode.Git)
      });
      await vi.waitUntil(() => calls >= 2, { timeout: 5000 });
      await screen.fixture.whenStable();

      expect([calls, ...screen.texts(".summary")]).toEqual([2, "4 commits become 3"]);
    });
  });

  it("drops advice found for rows that changed while it was checked", async () => {
    const screen: Screen = Screen.render({ "git.rebasePlan": plan.toJson() }, target, ["git.rebaseCheck"]);
    (await screen.held.nextAsync("git.rebaseCheck"))(checks(clean, clean, new GitRebaseStepCheck(RebaseCheckOutcome.Conflicts, ["lanes.ts"]), clean));
    const place: (answer: JsonValue | Error) => void = await screen.held.nextAsync("git.rebaseCheck");

    screen.key(3, "d");
    const changed: (answer: JsonValue | Error) => void = await screen.held.nextAsync("git.rebaseCheck");
    place(checks(clean, clean, clean, clean));
    changed(checks(clean, clean, clean, new GitRebaseStepCheck(RebaseCheckOutcome.Dropped, [])));
    await screen.readyAsync();
    await screen.fixture.whenStable();

    expect([screen.requested("git.rebaseCheck").length, ...screen.texts(".summary")]).toEqual([3, "4 commits become 2"]);
  });

  it("shows checks git can't run as not checked, keeps only the latest steps' answer, and leaves rows checking when the check fails", async () => {
    let calls: number = 0;
    const screen: Screen = Screen.render({
      "git.rebasePlan": plan.toJson(),
      "git.rebaseCheck": () => ++calls === 1 ? checks(...Array.from({ length: 4 }, () => new GitRebaseStepCheck(RebaseCheckOutcome.Unavailable, [])))
        : GitFixtures.failure(FailureCode.Git)
    });
    await screen.readyAsync();
    expect(screen.texts(".check-text")).toEqual(Array.from({ length: 4 }, () => "Not checked on this git"));

    screen.key(1, "p");
    await vi.waitUntil(() => calls === 2);

    expect(screen.texts(".check-text")).toEqual(["Checking…", "Checking…", "Checking…", "Checking…"]);
    expect(screen.all(".stop-card")).toEqual([]);
  });

  it("drops a check answered after the steps changed again", async () => {
    const screen: Screen = Screen.render({ "git.rebasePlan": plan.toJson() }, target, ["git.rebaseCheck"]);
    const first: (answer: JsonValue | Error) => void = await screen.held.nextAsync("git.rebaseCheck");

    screen.key(3, "d");
    const second: (answer: JsonValue | Error) => void = await screen.held.nextAsync("git.rebaseCheck");
    first(checks(clean, clean, clean, clean));
    await screen.fixture.whenStable();
    expect(screen.texts(".check-text")).toEqual(["Checking…", "Checking…", "Checking…", "Left out"]);
    second(checks(clean, clean, clean, new GitRebaseStepCheck(RebaseCheckOutcome.Dropped, [])));
    await screen.readyAsync();

    expect(screen.texts(".check-text")).toEqual(["Applies cleanly", "Applies cleanly", "Applies cleanly", "Left out"]);
  });

  it("stays open with git's refusal when the rebase fails, and closes on Cancel", async () => {
    const screen: Screen = Screen.render({
      "git.rebasePlan": plan.toJson(), "git.rebaseCheck": () => checks(clean, clean, clean, clean), "git.rebase": GitFixtures.failure(FailureCode.Git, null, "Git refused the rebase.")
    });
    await screen.readyAsync();

    screen.find<HTMLButtonElement>(".start").click();
    await vi.waitUntil(() => screen.texts(".options .failure").length > 0);
    expect(screen.texts(".options .failure")).toEqual(["Git refused the rebase."]);
    expect(screen.context.callsOf("closeDocument")).toEqual([]);

    screen.find<HTMLButtonElement>(".cancel").click();
    expect(screen.context.callsOf("closeDocument")).toEqual([["git.interactiveRebase", GitFixtures.folder]]);
  });

  it("holds Show the conflict while the conflict is only predicted, and opens the conflicts screen at the file once the rebase really stops on it", async () => {
    let stopped: boolean = false;
    const screen: Screen = Screen.render({
      "git.rebasePlan": plan.toJson(), "git.rebaseCheck": () => checks(clean, clean, new GitRebaseStepCheck(RebaseCheckOutcome.Conflicts, ["lanes.ts"]), clean),
      "git.rebase": () => {
        stopped = true;
        return GitFixtures.failure(FailureCode.Git, null, "Git stopped on a conflict.");
      },
      "git.status": () => (stopped
        ? GitFixtures.status([GitFixtures.entry("lanes.ts", FileState.Unmodified, FileState.Unmodified, null, ConflictKind.BothModified)], null,
          { fingerprint: "f2", operation: new GitOperation(OperationKind.Rebase, "main", null) })
        : GitFixtures.status([], null, { fingerprint: "f1", ...onPlan })).toJson()
    });
    screen.context.allow("openDocument");
    onTestFinished(() => GitResolving.opened.set(new Map()));
    await screen.readyAsync();
    const button = (): HTMLButtonElement => screen.find<HTMLButtonElement>(".show-conflict");
    const predicted: readonly unknown[] = [button().disabled, button().title];

    screen.find<HTMLButtonElement>(".start").click();
    await vi.waitUntil(() => !button().disabled, { timeout: 5000 });
    button().click();

    expect(predicted).toEqual([true, "Opens the conflict once the rebase stops on it"]);
    expect([button().title, screen.context.callsOf("openDocument"), GitResolving.pathOf(GitFixtures.folder)])
      .toEqual(["Show the conflict now", [["git.conflicts", GitFixtures.folder, expect.any(String)]], "lanes.ts"]);
  });

  it("holds Show the conflict for a rebase stopped without a conflicted file, and while the Git panel follows another folder's stopped rebase", async () => {
    let conflicted: boolean = false;
    const operation: GitOperation = new GitOperation(OperationKind.Rebase, "main", null);
    const screen: Screen = Screen.render({
      "git.rebasePlan": plan.toJson(), "git.rebaseCheck": () => checks(clean, clean, new GitRebaseStepCheck(RebaseCheckOutcome.Conflicts, ["lanes.ts"]), clean),
      "git.rebase": () => GitFixtures.failure(FailureCode.Git, null, "Git stopped at an edit."),
      "git.status": () => GitFixtures.status(conflicted ? [GitFixtures.entry("lanes.ts", FileState.Unmodified, FileState.Unmodified, null, ConflictKind.BothModified)] : [],
        null, { fingerprint: conflicted ? "f3" : "f2", operation, ...onPlan }).toJson()
    });
    await screen.readyAsync();
    const button = (): HTMLButtonElement => screen.find<HTMLButtonElement>(".show-conflict");
    const statusReads = (folder: string): number => screen.requested("git.status").filter(t => JSON.stringify(t).includes(JSON.stringify(folder))).length;

    screen.find<HTMLButtonElement>(".start").click();
    await vi.waitUntil(() => screen.texts(".options .failure").length > 0, { timeout: 5000 });
    const atEdit: boolean = button().disabled;
    conflicted = true;
    onTestFinished(GitFolder.show("/work/other"));
    screen.active.set(false);
    await vi.waitUntil(() => statusReads("/work/other") > 0, { timeout: 5000 });
    await screen.fixture.whenStable();
    const elsewhere: boolean = button().disabled;
    screen.active.set(true);
    await vi.waitUntil(() => !button().disabled, { timeout: 5000 });

    expect([atEdit, elsewhere, button().title]).toEqual([true, true, "Show the conflict now"]);
  });

  it("selects a row by click or focus, and sets its action from the select, ignoring a value that is no action", async () => {
    const screen: Screen = Screen.render({ "git.rebasePlan": plan.toJson(), "git.rebaseCheck": () => checks(clean, clean, clean, clean) });
    await screen.readyAsync();
    const select: SelectComponent = screen.fixture.debugElement.query(By.directive(SelectComponent)).injector.get(SelectComponent);

    screen.row(2).click();
    screen.fixture.detectChanges();
    expect(screen.texts(".steps .step.selected .id")).toEqual(["ccccccc"]);
    screen.row(3).dispatchEvent(new FocusEvent("focus"));
    screen.fixture.detectChanges();
    expect(screen.texts(".steps .step.selected .id")).toEqual(["eeeeeee"]);
    select.valueChange.emit("Edit");
    select.valueChange.emit("Nothing");
    screen.fixture.detectChanges();

    expect(select.value()).toBe("Edit");
  });

  it("holds Start and reads the plan again once the branch moves under it, as after a commit, then starts with the new plan's steps", async () => {
    const later: GitRebaseCommit = new GitRebaseCommit("9".repeat(40), "Commit made after the plan", null);
    const moved: GitRebasePlan = new GitRebasePlan("feature/graph", onto, base, 4, [a, c, fix, wip, later], ["feature/minimap"], true);
    let head: string = wip.id;
    const screen: Screen = Screen.render({
      "git.rebasePlan": () => (head === wip.id ? plan : moved).toJson(), "git.rebaseCheck": () => (head === wip.id ? checks(clean, clean, clean, clean) : checks(clean, clean, clean, clean, clean)), "git.rebase": null,
      "git.status": () => GitFixtures.status([], null, { fingerprint: head === wip.id ? "f1" : "f2", branch: "feature/graph", head }).toJson()
    });
    await screen.readyAsync();
    const start = (): HTMLButtonElement => screen.find<HTMLButtonElement>(".start");
    const before: boolean = start().disabled;

    head = later.id;
    screen.context.raiseEvent("git.changed", { folder: GitFixtures.folder });
    await vi.waitUntil(() => screen.requested("git.rebasePlan").length === 2 && !start().disabled, { timeout: 5000 });
    start().click();
    await vi.waitUntil(() => screen.requested("git.rebase").length === 1, { timeout: 5000 });

    expect(before).toBe(false);
    expect(screen.requested("git.rebase")).toEqual([expect.objectContaining({ basedOn: "f2",
      steps: [a, fix, c, wip, later].map(t => expect.objectContaining({ id: t.id })) })]);
  });

  it("holds Start while the Git panel's status names another branch or commit than the plan was read for", async () => {
    const screen: Screen = Screen.render({ "git.rebasePlan": plan.toJson(), "git.rebaseCheck": () => checks(clean, clean, clean, clean),
      "git.status": GitFixtures.status([], null, { fingerprint: "f1", branch: "main", head: wip.id }).toJson() });
    await screen.readyAsync();

    expect([screen.requested("git.rebasePlan").length, screen.find<HTMLButtonElement>(".start").disabled]).toEqual([2, true]);
  });

  it("keeps only the plan for the commit the screen rebases onto now", async () => {
    const screen: Screen = Screen.render({ "git.rebaseCheck": () => checks(clean) }, target, ["git.rebasePlan"]);
    const first: (answer: JsonValue | Error) => void = await screen.held.nextAsync("git.rebasePlan");

    GitRebasing.open(GitFixtures.folder, new GitRebaseTarget(base, "develop"));
    const second: (answer: JsonValue | Error) => void = await screen.held.nextAsync("git.rebasePlan");
    first(plan.toJson());
    await screen.fixture.whenStable();
    expect(screen.element.querySelector(".steps")).toBeNull();
    second(new GitRebasePlan("feature/graph", base, base, 0, [c], [], false).toJson());
    await vi.waitUntil(() => screen.ids().length > 0);

    expect([screen.ids(), screen.texts(".title")]).toEqual([["ccccccc"], ["Rebase one commit of feature/graph onto develop"]]);
  });

  it("drops Git's refusal of an older plan read that answers after the screen asked again", async () => {
    const reads = vi.spyOn(GitRuntimeClient.prototype, "rebasePlanAsync");
    onTestFinished(() => reads.mockRestore());
    const screen: Screen = Screen.render({ "git.rebaseCheck": () => checks(clean) }, target, ["git.rebasePlan"]);
    const first: (answer: JsonValue | Error) => void = await screen.held.nextAsync("git.rebasePlan");

    GitRebasing.open(GitFixtures.folder, new GitRebaseTarget(base, "develop"));
    const second: (answer: JsonValue | Error) => void = await screen.held.nextAsync("git.rebasePlan");
    second(new GitRebasePlan("feature/graph", base, base, 0, [c], [], false).toJson());
    await vi.waitUntil(() => screen.ids().length > 0);
    first(GitFixtures.failure(FailureCode.Git, null, "The older read failed."));
    await Promise.allSettled(reads.mock.results.flatMap(t => t.type === "return" ? [t.value] : []));
    await screen.fixture.whenStable();

    expect([screen.ids(), screen.element.textContent?.includes("The older read failed.")]).toEqual([["ccccccc"], false]);
  });

  it("reports a plan that fails other than by Git's refusal", async () => {
    const handled: unknown[] = [];
    const broken: Error = new Error("The channel closed.");
    const screen: Screen = Screen.render({ "git.rebasePlan": broken });
    vi.spyOn(TestBed.inject(ErrorHandler), "handleError").mockImplementation(error => handled.push(error));
    await vi.waitUntil(() => handled.length === 1);

    expect([handled, screen.element.querySelector(".steps")]).toEqual([[broken], null]);
  });

  it("reports a check or a rebase that fails other than by Git's refusal, staying open", async () => {
    const handled: unknown[] = [];
    const broken: Error = new Error("The channel closed.");
    const screen: Screen = Screen.render({ "git.rebasePlan": plan.toJson(), "git.rebaseCheck": broken, "git.rebase": broken });
    vi.spyOn(TestBed.inject(ErrorHandler), "handleError").mockImplementation(error => handled.push(error));
    await vi.waitUntil(() => handled.length === 1);

    screen.find<HTMLButtonElement>(".start").click();
    await vi.waitUntil(() => handled.length === 2);

    expect(handled).toEqual([broken, broken]);
    expect(screen.context.callsOf("closeDocument")).toEqual([]);
  });

  it("says how to start one without a commit to rebase onto, leaving the Rebase preview view empty and closed", () => {
    const screen: Screen = Screen.render({}, null);

    expect([screen.texts(".note"), screen.texts(".empty-view"), screen.context.callsOf("openView")])
      .toEqual([["Open a commit's detail and choose Rebase onto here to start a rebase."], ["Open an interactive rebase to preview it."], []]);
  });

  it("shows git's failure to read the plan", async () => {
    const failing: Screen = Screen.render({ "git.rebasePlan": GitFixtures.failure(FailureCode.Git, null, "Git couldn't read the branch.") });
    await vi.waitUntil(() => failing.texts(".note").length > 0);
    expect(failing.texts(".note")).toEqual(["Git couldn't read the branch."]);
  });

  it("says a branch has nothing to rebase, names a detached HEAD, and holds Start and the stacked option", async () => {
    const empty: Screen = Screen.render({ "git.rebasePlan": new GitRebasePlan(null, onto, onto, 0, [], [], false).toJson() });
    await vi.waitUntil(() => empty.texts(".note").length > 0);

    expect(empty.texts(".note")).toEqual(["The branch has no commits past this one to rebase."]);
    expect(empty.texts(".title")).toEqual(["Rebase 0 commits of the detached HEAD onto main"]);
    expect(empty.words(".now .node")[0]).toBe("HEAD");
    expect(empty.find<HTMLInputElement>(".move-stacked input").getAttribute("aria-disabled")).toBe("true");
    expect(empty.find<HTMLButtonElement>(".start").disabled).toBe(true);
  });

  it("lines up each column across the rows, indents a folded row, and cuts a long message short inside its row", async () => {
    const long: GitRebaseCommit = new GitRebaseCommit("d".repeat(40), "A very long message ".repeat(20), null);
    const screen: Screen = Screen.render({
      "git.rebasePlan": new GitRebasePlan("feature/graph", onto, base, 4, [a, fix, long], [], false).toJson(), "git.rebaseCheck": () => checks(clean, clean, clean)
    });
    await screen.readyAsync();
    const lefts = (selector: string): readonly number[] => [...screen.element.querySelectorAll(selector)].map(t => t.getBoundingClientRect().left);
    const message: HTMLElement = screen.row(2).querySelector<HTMLElement>(".message") ?? screen.row(2);
    const checkBox: DOMRect = screen.row(2).querySelector<HTMLElement>(".check")?.getBoundingClientRect() ?? new DOMRect();

    expect(new Set(lefts(".steps .step:not(.folded) .action")).size).toBe(1);
    expect(rem((lefts(".steps .step.folded .handle")[0] ?? 0) - (lefts(".steps .step:not(.folded) .handle")[0] ?? 0))).toBeCloseTo(1.75, 2);
    expect([message.scrollWidth > message.clientWidth, message.getBoundingClientRect().right <= checkBox.left + 1]).toEqual([true, true]);
    expect(rem(screen.row(0).getBoundingClientRect().height)).toBeGreaterThanOrEqual(2.25);
  });

  it("offers Tidy up for review, not built yet, after the title only while the app turns AI features on", async () => {
    const screen: Screen = Screen.render({ "git.rebasePlan": plan.toJson(), "git.rebaseCheck": checks(clean, clean, clean, clean) });
    await screen.readyAsync();
    const off: readonly unknown[] = [screen.element.querySelectorAll(".tidy-up").length,
      screen.find(".title-row").lastElementChild?.classList.contains("title") === true];
    GitViewOptions.showsAiFeatures.set(true);
    onTestFinished(() => GitViewOptions.showsAiFeatures.set(false));
    await vi.waitUntil(() => !Object.isNull(screen.element.querySelector(".tidy-up")));
    const tidy: HTMLButtonElement = screen.find<HTMLButtonElement>(".tidy-up");

    expect([off, tidy.disabled, tidy.title, screen.find(".title-row").lastElementChild === tidy]).toEqual([[0, true], true, "Not built yet", true]);
  });
});
