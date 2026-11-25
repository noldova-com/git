/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { type DebugElement, ErrorHandler, signal, type WritableSignal } from "@angular/core";
import { type ComponentFixture, TestBed } from "@angular/core/testing";
import { By } from "@angular/platform-browser";
import "@noldova/context.core";
import { WindowPartTokens } from "@noldova/desktop.window";
import { FakeWindowPartContext } from "@noldova/desktop.window/testing";
import { MergeEditorComponent, ShikiLineTokenizer } from "@noldova/editor.angular";
import {
  ConflictKind, ConflictResolution, FailureCode, FileState, GitConflict, GitMarkerCheck, GitOperation, GitPrediction, type GitStatus, type JsonValue, OperationKind,
  PredictionOutcome, type StatusEntry
} from "@noldova/git.protocol";
import { describe, expect, it, onTestFinished, vi } from "vitest";

import { GitConflictDetailComponent } from "../../../../src/app/components/git-conflict-detail/git-conflict-detail.component.ts";
import { GitConflictsComponent } from "../../../../src/app/components/git-conflicts/git-conflicts.component.ts";
import { GitResolvedBy } from "../../../../src/app/enums/git-resolved-by.ts";
import { GitResolving } from "../../../../src/app/services/git-resolving.ts";
import { GitViewStateService } from "../../../../src/app/services/git-view-state.service.ts";
import { GitFixtures } from "../../../fixtures/git-fixtures.fixture.ts";
import { GitHeldRequests } from "../../../fixtures/git-held-requests.fixture.ts";

describe("GitConflictsComponent", () => {
  // As the runtime sends a merge: the merge head's id, and git's prepared message naming the branch.
  const mergeHead: string = "c0ffee0123456789abcdef0123456789abcdef01";
  const merge: GitOperation = new GitOperation(OperationKind.Merge, mergeHead, "Merge branch 'feature'");
  const both: GitConflict = new GitConflict("a.ts", ConflictKind.BothModified, OperationKind.Merge, "b\n", "ours\n", "theirs\n", "m\n", "main", "feature", null, null, false, false);
  const bothC: GitConflict = new GitConflict("c.ts", ConflictKind.BothModified, OperationKind.Merge, "b\n", "ours c\n", "theirs c\n", "m\n", "main", "feature", null, null, false, false);

  const statusOf = (entries: readonly StatusEntry[], fingerprint: string, operation: GitOperation | null = merge): GitStatus =>
    GitFixtures.status(entries, null, { operation, fingerprint });

  const marked: GitConflict = new GitConflict("a.ts", ConflictKind.BothModified, OperationKind.Merge, "b\n", "ours\n", "theirs\n",
    "<<<<<<< main\nours\n=======\ntheirs\n>>>>>>> feature\n", "main", "feature", null, null, false, false);

  const labelOf = (button: HTMLElement): string =>
    (button.textContent ?? "").replace(button.querySelector("[nolButtonIcon]")?.textContent ?? "", "").trim();
  const twice: string = "<<<<<<< main\nours 1\n=======\ntheirs 1\n>>>>>>> feature\nkept\n<<<<<<< main\nours 2\n=======\ntheirs 2\n>>>>>>> feature\n";

  const conflictEntry = (path: string, kind: ConflictKind = ConflictKind.BothModified): StatusEntry =>
    GitFixtures.entry(path, FileState.Unmodified, FileState.Unmodified, null, kind);

  class Screen {
    public readonly context: FakeWindowPartContext;
    public readonly fixture: ComponentFixture<GitConflictsComponent>;
    /** The Conflict view beside the document, which shows its current conflict while it is in front. */
    public readonly view: ComponentFixture<GitConflictDetailComponent>;
    public readonly folder: WritableSignal<string | null>;
    public readonly held: GitHeldRequests;

    public constructor(context: FakeWindowPartContext, fixture: ComponentFixture<GitConflictsComponent>, view: ComponentFixture<GitConflictDetailComponent>,
      folder: WritableSignal<string | null>, held: GitHeldRequests) {
      this.context = context;
      this.fixture = fixture;
      this.view = view;
      this.folder = folder;
      this.held = held;
    }

    public get state(): GitViewStateService {
      return this.fixture.debugElement.injector.get(GitViewStateService);
    }

    public get element(): HTMLElement {
      return this.fixture.nativeElement;
    }

    public get viewElement(): HTMLElement {
      return this.view.nativeElement;
    }

    public static render(answers: Readonly<Record<string, JsonValue | Error | (() => JsonValue | Error)>>, instance: string = GitFixtures.folder,
      held: readonly string[] = [], active: WritableSignal<boolean> = signal(true)): Screen {
      const context: FakeWindowPartContext = new FakeWindowPartContext();
      const requests: GitHeldRequests = new GitHeldRequests(context, held, { ...GitFixtures.watching, "git.markerCheck": new GitMarkerCheck([]).toJson(), ...answers });
      const folder: WritableSignal<string | null> = GitFixtures.setUp(context, [{ provide: WindowPartTokens.activeDocument, useValue: active }]);
      onTestFinished(() => {
        GitResolving.opened.set(new Map());
        GitResolving.resolutions.set(new Map());
      });
      const fixture: ComponentFixture<GitConflictsComponent> = TestBed.createComponent(GitConflictsComponent);
      fixture.componentRef.setInput("instance", instance);
      fixture.autoDetectChanges();
      const view: ComponentFixture<GitConflictDetailComponent> = TestBed.createComponent(GitConflictDetailComponent);
      view.componentRef.setInput("instance", "selected");
      view.autoDetectChanges();
      // TestBed takes the earlier fixtures' root elements out of the page as it creates a component, so the document goes back beside the view.
      document.body.append(fixture.nativeElement);
      return new Screen(context, fixture, view, folder, requests);
    }

    /** The matches in the document, then in the Conflict view, as the window shows them side by side. */
    public all(selector: string): readonly Element[] {
      return [...this.element.querySelectorAll(selector), ...this.viewElement.querySelectorAll(selector)];
    }

    public texts(selector: string): readonly string[] {
      return this.all(selector).map(t => (t.textContent ?? "").replace(/\s+/gu, " ").trim());
    }

    public find<T extends HTMLElement = HTMLElement>(selector: string): T {
      const found: T | null = this.element.querySelector<T>(selector);
      if (Object.isNull(found))
        throw new Error(`Nothing matches ${selector}.`);
      return found;
    }

    public untilAsync(done: () => boolean): Promise<void> {
      if (done())
        return Promise.resolve();
      return new Promise(resolve => {
        const observer: MutationObserver = new MutationObserver(() => {
          if (!done())
            return;
          observer.disconnect();
          resolve();
        });
        observer.observe(this.element, { attributes: true, characterData: true, childList: true, subtree: true });
        observer.observe(this.viewElement, { attributes: true, characterData: true, childList: true, subtree: true });
      });
    }

    public editor(): MergeEditorComponent | null {
      const found: DebugElement | null = this.fixture.debugElement.query(By.directive(MergeEditorComponent));
      return Object.isNull(found) ? null : found.injector.get(MergeEditorComponent);
    }

    public sides(): readonly (string | null)[] {
      const editor: MergeEditorComponent | null = this.editor();
      return Object.isNull(editor) ? [] : [editor.ours(), editor.theirs()];
    }

    public requested(method: string): readonly unknown[] {
      return this.context.callsOf("requestAsync").filter(t => t[0] === method).map(t => t[1]);
    }
  }

  it("heads the screen with the operation, its progress, abort and a commit held while conflicts remain, lists its files, and shows the opened file's sides", async () => {
    GitResolving.open(GitFixtures.folder, "c.ts");
    const screen: Screen = Screen.render({
      "git.status": statusOf([conflictEntry("a.ts"), conflictEntry("c.ts"), GitFixtures.entry("b.ts", FileState.Modified, FileState.Unmodified)], "f1").toJson(),
      "git.conflict": new GitConflict("c.ts", ConflictKind.BothModified, OperationKind.Merge, "b\n", "ours c\n", "theirs c\n", "m\n", "main", "feature", null, null, false, false).toJson()
    });

    await vi.waitUntil(() => screen.sides().length > 0);

    expect(screen.texts(".operation-text")).toEqual(["Merging feature into main · 0 of 2 files resolved"]);
    expect([labelOf(screen.find(".abort")), screen.find<HTMLButtonElement>(".abort").disabled]).toEqual(["Abort merge", false]);
    expect([labelOf(screen.find(".continue")), screen.find<HTMLButtonElement>(".continue").disabled]).toEqual(["Commit the merge", true]);
    expect(screen.texts(".group")).toEqual(["Conflicts 2", "Merged cleanly 1"]);
    expect(screen.texts(".file .name")).toEqual(["a.ts", "c.ts", "b.ts"]);
    expect(screen.texts(".file.selected .name")).toEqual(["c.ts"]);
    expect([screen.editor()?.oursLabel(), screen.editor()?.theirsLabel()]).toEqual(["main", "feature"]);
    expect(screen.sides()).toEqual(["ours c\n", "theirs c\n"]);
    expect([screen.element.querySelector(".delete"), screen.element.querySelector(".note-line")]).toEqual([null, null]);
    expect(screen.requested("git.conflict")).toEqual([{ folder: GitFixtures.folder, path: "c.ts" }]);
  });

  it("sets the operation's bar right under the title bar, with 0.25rem at the sides and the bottom", async () => {
    const rem = (pixels: number): number => pixels / Number.parseFloat(getComputedStyle(document.documentElement).fontSize);
    const screen: Screen = Screen.render({
      "git.status": statusOf([conflictEntry("c.ts")], "f1").toJson(),
      "git.conflict": new GitConflict("c.ts", ConflictKind.BothModified, OperationKind.Merge, "b\n", "ours c\n", "theirs c\n", "m\n", "main", "feature", null, null, false, false).toJson()
    });
    screen.element.style.height = "30rem";
    await vi.waitUntil(() => screen.sides().length > 0);
    const host: DOMRect = screen.element.getBoundingClientRect();
    const operation: DOMRect = screen.element.querySelector(".operation")?.getBoundingClientRect() ?? host;
    const body: DOMRect = screen.element.querySelector(".body")?.getBoundingClientRect() ?? host;

    expect([rem(operation.top - host.top), rem(operation.left - host.left), rem(host.right - operation.right), rem(host.bottom - body.bottom)]).toEqual([0, 0.25, 0.25, 0.25]);
  });

  it("resolves the file with one side, moves it to Resolved with that side's name, then commits the operation, or aborts it", async () => {
    let status: GitStatus = statusOf([conflictEntry("a.ts")], "f1");
    const screen: Screen = Screen.render({
      "git.status": () => status.toJson(), "git.conflict": both.toJson(), "git.resolveConflict": () => {
        status = statusOf([GitFixtures.entry("a.ts", FileState.Modified, FileState.Unmodified)], "f2");
        return null;
      }, "git.continueOperation": null, "git.abortOperation": null
    });
    await screen.untilAsync(() => !Object.isNull(screen.element.querySelector(".take-theirs")));

    screen.find<HTMLButtonElement>(".take-theirs").click();
    await screen.untilAsync(() => screen.texts(".group").includes("Resolved 1"));

    expect(screen.requested("git.resolveConflict")).toEqual([{ folder: GitFixtures.folder, path: "a.ts", resolution: "Theirs", text: null, basedOn: "f1" }]);
    expect(screen.texts(".group")).toEqual(["Conflicts 0", "Resolved 1"]);
    expect([screen.texts(".file.resolved .name"), screen.texts(".file.resolved .note")]).toEqual([["a.ts"], ["theirs"]]);
    expect(screen.texts(".operation-text")).toEqual(["Merging feature into main · 1 of 1 file resolved"]);
    expect(screen.texts(".quiet")).toEqual(["Every conflict is resolved. Commit to finish."]);
    expect(screen.find<HTMLButtonElement>(".continue").disabled).toBe(false);

    screen.find<HTMLButtonElement>(".continue").click();
    await GitFixtures.untilAsync(() => !screen.state.busy() && screen.requested("git.continueOperation").length === 1);
    screen.find<HTMLButtonElement>(".abort").click();
    await GitFixtures.untilAsync(() => !screen.state.busy() && screen.requested("git.abortOperation").length === 1);

    expect([screen.requested("git.continueOperation"), screen.requested("git.abortOperation")])
      .toEqual([[{ folder: GitFixtures.folder, basedOn: "f2" }], [{ folder: GitFixtures.folder, basedOn: "f2" }]]);
  });

  it("names the operation's target as this branch only while HEAD is detached", async () => {
    const screen: Screen = Screen.render({
      "git.status": GitFixtures.status([conflictEntry("c.ts")], null, { operation: merge, fingerprint: "f1", branch: null }).toJson(),
      "git.conflict": bothC.toJson()
    });
    await screen.untilAsync(() => !Object.isNull(screen.element.querySelector(".operation-text")));

    expect(screen.texts(".operation-text")).toEqual(["Merging feature into this branch · 0 of 1 file resolved"]);
  });

  it("lists the files the operation conflicted on that are out of conflict now as Resolved, as after a restart or a resolution outside the screen, reading them once per operation", async () => {
    let reads = 0;
    const screen: Screen = Screen.render({
      "git.status": () => statusOf([conflictEntry("c.ts"), GitFixtures.entry("a.ts", FileState.Modified, FileState.Unmodified),
        GitFixtures.entry("b.ts", FileState.Modified, FileState.Unmodified), GitFixtures.entry("d.ts", FileState.Deleted, FileState.Unmodified)], `f${++reads}`).toJson(),
      "git.conflict": bothC.toJson(),
      "git.predict": new GitPrediction(PredictionOutcome.Conflicts, ["a.ts", "c.ts", "d.ts"]).toJson()
    });
    await screen.untilAsync(() => screen.texts(".group").includes("Resolved 2"));
    await screen.state.refreshAsync();

    expect(screen.texts(".group")).toEqual(["Conflicts 1", "Resolved 2", "Merged cleanly 1"]);
    expect([screen.texts(".file.resolved .name"), screen.texts(".file.resolved .note")]).toEqual([["a.ts", "d.ts"], ["", ""]]);
    expect(screen.texts(".operation-text")).toEqual(["Merging feature into main · 2 of 3 files resolved"]);
    expect([reads > 1, screen.requested("git.predict")]).toEqual([true, [{ folder: GitFixtures.folder, id: mergeHead, action: "Merge" }]]);
  });

  it("reads no first conflicts for a rebase or a head that isn't a commit id, keeps only the newest operation's answer, and keeps to the screen's own resolutions when the read fails", async () => {
    const pick: GitOperation = new GitOperation(OperationKind.CherryPick, "ab".repeat(20), "Draw lanes");
    const revert: GitOperation = new GitOperation(OperationKind.Revert, "cd".repeat(20), "Revert \"Draw lanes\"");
    const operations: readonly GitOperation[] = [new GitOperation(OperationKind.Rebase, "feature", null), new GitOperation(OperationKind.Merge, null, null), merge, pick, revert,
      new GitOperation(OperationKind.Rebase, "main", null)];
    let step = 0;
    const screen: Screen = Screen.render({
      "git.status": () => statusOf([conflictEntry("c.ts"), GitFixtures.entry("a.ts", FileState.Modified, FileState.Unmodified)], `f${step}`, operations[step] ?? null).toJson(),
      "git.conflict": bothC.toJson()
    }, GitFixtures.folder, ["git.predict"]);
    await screen.untilAsync(() => screen.texts(".group").includes("Conflicts 1"));
    // Each operation shows in the banner before the next, so the screen's effects see every one.
    const nextAsync = async (): Promise<void> => {
      const shown: string = screen.texts(".operation-text").join();
      step++;
      await screen.state.refreshAsync();
      await screen.untilAsync(() => screen.texts(".operation-text").join() !== shown);
    };
    await nextAsync();
    await nextAsync();
    await nextAsync();
    const stale: (answer: JsonValue | Error) => void = await screen.held.nextAsync("git.predict");
    await screen.held.answerAsync("git.predict", new GitPrediction(PredictionOutcome.Conflicts, ["c.ts", "e.ts"]).toJson());
    await screen.untilAsync(() => screen.texts(".group").includes("Resolved 1"));
    const picked: readonly string[] = screen.texts(".file.resolved .name");
    stale(new GitPrediction(PredictionOutcome.Conflicts, ["a.ts", "c.ts"]).toJson());
    await screen.state.refreshAsync();
    const afterStale: readonly string[] = screen.texts(".file.resolved .name");
    await nextAsync();
    await screen.held.answerAsync("git.predict", new Error("git merge-tree failed."));
    await screen.state.refreshAsync();
    const failed: readonly string[] = screen.texts(".group");
    GitResolving.record(GitFixtures.folder, "a.ts", GitResolvedBy.Ours);
    await nextAsync();

    expect([picked, afterStale, failed]).toEqual([["e.ts"], ["e.ts"], ["Conflicts 1", "Merged cleanly 1"]]);
    expect([screen.texts(".group"), screen.texts(".file.resolved .name"), screen.texts(".file.resolved .note")]).toEqual([["Conflicts 1", "Resolved 1"], ["a.ts"], ["ours"]]);
    expect(screen.requested("git.predict").map(t => JSON.stringify(t))).toEqual([
      { folder: GitFixtures.folder, id: mergeHead, action: "Merge" }, { folder: GitFixtures.folder, id: "ab".repeat(20), action: "CherryPick" },
      { folder: GitFixtures.folder, id: "cd".repeat(20), action: "Revert" }
    ].map(t => JSON.stringify(t)));
  });

  it("holds Mark resolved while the merge editor has a conflict left, then resolves the file with the editor's text", async () => {
    const screen: Screen = Screen.render({
      "git.status": statusOf([conflictEntry("a.ts")], "f1").toJson(), "git.conflict": marked.toJson(), "git.resolveConflict": null
    });
    await vi.waitUntil(() => (screen.editor()?.unresolvedCount() ?? 0) > 0);
    const held: boolean = screen.find<HTMLButtonElement>(".mark-resolved").disabled;

    screen.editor()?.acceptAll("Theirs");
    await vi.waitUntil(() => !screen.find<HTMLButtonElement>(".mark-resolved").disabled);
    const text: string | null = screen.editor()?.result() ?? null;
    screen.find<HTMLButtonElement>(".mark-resolved").click();
    await GitFixtures.untilAsync(() => !screen.state.busy() && screen.requested("git.resolveConflict").length === 1);

    expect([held, text]).toEqual([true, "theirs\n"]);
    expect(screen.requested("git.resolveConflict")).toEqual([{ folder: GitFixtures.folder, path: "a.ts", resolution: ConflictResolution.Text, text, basedOn: "f1" }]);
  });

  it.each([
    ["both sides of every conflict, in either order", "both", ["BothOursFirst", "BothTheirsFirst"]],
    ["both sides of one conflict and theirs of the other", "edited", ["BothOursFirst", "Theirs"]]
  ] as const)("notes a file resolved in the merge editor with %s as %s, writing the editor's text either way", async (_, note, choices) => {
    let status: GitStatus = statusOf([conflictEntry("a.ts")], "f1");
    const screen: Screen = Screen.render({
      "git.status": () => status.toJson(),
      "git.conflict": new GitConflict("a.ts", ConflictKind.BothModified, OperationKind.Merge, "b\n", "ours\n", "theirs\n", twice, "main", "feature", null, null, false, false).toJson(),
      "git.resolveConflict": () => {
        status = statusOf([GitFixtures.entry("a.ts", FileState.Modified, FileState.Unmodified)], "f2");
        return null;
      }
    });
    await vi.waitUntil(() => screen.editor()?.unresolvedCount() === 2);

    choices.forEach((choice, index) => screen.editor()?.accept(index, choice));
    await vi.waitUntil(() => !screen.find<HTMLButtonElement>(".mark-resolved").disabled);
    screen.find<HTMLButtonElement>(".mark-resolved").click();
    await screen.untilAsync(() => screen.texts(".file.resolved .note").length === 1);

    expect(screen.requested("git.resolveConflict")).toEqual([expect.objectContaining({ path: "a.ts", resolution: ConflictResolution.Text })]);
    expect([screen.texts(".file.resolved .name"), screen.texts(".file.resolved .note")]).toEqual([["a.ts"], [note]]);
  });

  it("holds Mark resolved when the file's conflict markers can't be read, and keeps the whole-file choices in a row of the frame's own", async () => {
    const screen: Screen = Screen.render({
      "git.status": statusOf([conflictEntry("a.ts")], "f1").toJson(),
      "git.conflict": new GitConflict("a.ts", ConflictKind.BothModified, OperationKind.Merge, "b\n", "ours\n", "theirs\n", "<<<<<<< ours\nours\n", "main", "feature", null, null, false, false).toJson()
    });
    await screen.untilAsync(() => !Object.isNull(screen.element.querySelector(".nol-merge-editor-failure")));

    expect([screen.texts(".nol-merge-editor-failure").length, screen.find<HTMLButtonElement>(".mark-resolved").disabled, screen.texts(".progress")]).toEqual([1, true, []]);
    expect([screen.texts(".merge-actions .take-ours"), screen.texts(".merge-actions .take-theirs"), screen.element.querySelectorAll(".pane-head").length])
      .toEqual([["Take all ours"], ["Take all theirs"], 0]);
    expect(screen.find(".merge-actions").getBoundingClientRect().bottom).toBeLessThanOrEqual(screen.find(".nol-merge-editor-failure").getBoundingClientRect().top);
  });

  it("heads Ours, Theirs and the result in the merge editor's cards with each side's short id once, moves between conflicts with Previous and Next, and notes each conflict's state", async () => {
    const screen: Screen = Screen.render({
      "git.status": statusOf([conflictEntry("a.ts")], "f1").toJson(),
      "git.conflict": new GitConflict("a.ts", ConflictKind.BothModified, OperationKind.Rebase, "b\n", "ours\n", "theirs\n", twice, "onto main", "your commit c4d2e17",
        `3b9f001${"0".repeat(33)}`, `c4d2e17${"0".repeat(33)}`, false, false).toJson()
    });
    const note = (): readonly string[] => screen.texts(".result .label");
    const title = (): string | undefined => screen.texts(".detail-title")[0];
    await vi.waitUntil(() => screen.texts(".progress").length > 0);
    const heads: readonly (readonly string[])[] = [".nol-merge-editor-side:first-child", ".nol-merge-editor-side:last-child", ".nol-merge-editor-output"]
      .map(card => screen.texts(`${card} > .pane-head .strong, ${card} > .pane-head .label`));
    const before: readonly string[] = note();

    screen.find<HTMLButtonElement>(".next").click();
    await screen.untilAsync(() => !Object.isUndefined(title()));
    const first: string | undefined = title();
    screen.find<HTMLButtonElement>(".next").click();
    await screen.untilAsync(() => title() !== first);
    const second: string | undefined = title();
    screen.find<HTMLButtonElement>(".previous").click();
    await screen.untilAsync(() => title() !== second);
    const back: string | undefined = title();
    screen.editor()?.accept(0, "Ours");
    await screen.untilAsync(() => note()[0] !== before[0]);

    expect(heads).toEqual([["Ours", "onto main · 3b9f001"], ["Theirs", "your commit c4d2e17"], ["Result", "editable · conflict 1 open, conflict 2 open"]]);
    expect([screen.element.querySelector(".nol-merge-editor-bar"), screen.element.querySelector(".merge-actions")]).toEqual([null, null]);
    expect([before, first, second, back, note()])
      .toEqual([["editable · conflict 1 open, conflict 2 open"], "Conflict 1 of 2", "Conflict 2 of 2", "Conflict 1 of 2", ["editable · conflict 1 resolved, conflict 2 open"]]);
  });

  it("shows the base between Ours and Theirs under its own head while Show base is pressed, and hides it again", async () => {
    const screen: Screen = Screen.render({
      "git.status": statusOf([conflictEntry("a.ts")], "f1").toJson(),
      "git.conflict": new GitConflict("a.ts", ConflictKind.BothModified, OperationKind.Merge, "b\n", "ours\n", "theirs\n", twice, "main", "feature", null, null, false, false).toJson()
    });
    await vi.waitUntil(() => screen.texts(".progress").length > 0);
    const show: HTMLButtonElement = screen.find<HTMLButtonElement>(".show-base");
    const before: readonly (string | null)[] = [show.getAttribute("aria-pressed"), show.textContent.trim(), screen.element.querySelector(".nol-merge-editor-base")?.tagName ?? null];

    show.click();
    await screen.untilAsync(() => !Object.isNull(screen.element.querySelector(".nol-merge-editor-base > .pane-head")));
    const shown: readonly (readonly string[] | string | null)[] = [show.getAttribute("aria-pressed"), screen.texts(".nol-merge-editor-base > .pane-head .strong, .nol-merge-editor-base > .pane-head .label"),
      [...screen.element.querySelectorAll(".nol-merge-editor-side")].map(t => t.querySelector(".pane-head .strong")?.textContent ?? "").join()];
    show.click();
    await screen.untilAsync(() => Object.isNull(screen.element.querySelector(".nol-merge-editor-base")));

    expect([before, shown, show.getAttribute("aria-pressed")]).toEqual([["false", "Show base", null], ["true", ["Base", "where both sides started"], "Ours,Base,Theirs"], "false"]);
  });

  it("counts the open file's resolved conflicts on its row as the merge editor resolves them, and no other file's", async () => {
    const screen: Screen = Screen.render({
      "git.status": statusOf([conflictEntry("a.ts"), conflictEntry("b.ts")], "f1").toJson(),
      "git.conflict": new GitConflict("a.ts", ConflictKind.BothModified, OperationKind.Merge, "b\n", "ours\n", "theirs\n", twice, "main", "feature", null, null, false, false).toJson()
    });
    await vi.waitUntil(() => screen.texts(".progress").length > 0);
    const before: readonly string[] = screen.texts(".file .progress");

    screen.editor()?.accept(0, "Theirs");
    await vi.waitUntil(() => screen.texts(".progress")[0] === "1 of 2");

    expect([before, screen.texts(".file.selected .progress"), screen.texts(".file:not(.selected) .progress")]).toEqual([["0 of 2"], ["1 of 2"], []]);
  });

  it("heads the detail panel with the active conflict, its base, and its lines in the result, which hold the base until a side is taken, and with nothing before one is active", async () => {
    const based: string = "<<<<<<< main\nours 1\n||||||| base\nbase 1a\nbase 1b\n=======\ntheirs 1\n>>>>>>> feature\nkept\n"
      + "<<<<<<< main\nours 2\n||||||| base\nbase 2\n=======\ntheirs 2a\ntheirs 2b\n>>>>>>> feature\n";
    const screen: Screen = Screen.render({
      "git.status": statusOf([conflictEntry("a.ts")], "f1").toJson(),
      "git.conflict": new GitConflict("a.ts", ConflictKind.BothModified, OperationKind.Merge, "b\n", "ours\n", "theirs\n", based, "main", "feature", null, null, false, false).toJson()
    });
    const head = (): readonly string[] => [...screen.texts(".detail-title"), ...screen.texts(".detail-lines"),
      ...screen.all(".base-text").map(t => [...t.querySelectorAll(".nol-code-text-line")].map(u => u.textContent).join(" "))];
    await vi.waitUntil(() => screen.texts(".progress").length > 0);
    const before: readonly string[] = head();

    screen.editor()?.nextConflict();
    await screen.untilAsync(() => head().length > 0);
    const first: readonly string[] = head();
    screen.editor()?.nextConflict();
    await screen.untilAsync(() => head()[0] !== first[0]);
    const second: readonly string[] = head();
    screen.editor()?.accept(1, "Theirs");
    await screen.untilAsync(() => head()[1] !== second[1]);

    expect([before, first, second, head()]).toEqual([
      [], ["Conflict 1 of 2", "lines 1 to 2", "base 1a base 1b"], ["Conflict 2 of 2", "line 4", "base 2"], ["Conflict 2 of 2", "lines 4 to 5", "base 2"]
    ]);
  });

  it("notes a conflict with no base, as when both sides added the file", async () => {
    const screen: Screen = Screen.render({
      "git.status": statusOf([conflictEntry("a.ts", ConflictKind.BothAdded)], "f1").toJson(),
      "git.conflict": new GitConflict("a.ts", ConflictKind.BothAdded, OperationKind.Merge, null, "ours\n", "theirs\n",
        "<<<<<<< main\nours\n=======\ntheirs\n>>>>>>> feature\n", "main", "feature", null, null, false, false).toJson()
    });
    await vi.waitUntil(() => screen.texts(".progress").length > 0);

    screen.editor()?.nextConflict();
    await screen.untilAsync(() => screen.texts(".base-note").length > 0);

    expect([screen.texts(".base-note"), screen.all(".base-text")]).toEqual([["No base: both sides added this text."], []]);
  });

  it("leaves the detail out of the document, the merge taking the width to 0.25rem from its right, and shows it in the Conflict view with 0.75rem inside", async () => {
    const rem = (pixels: number): number => pixels / Number.parseFloat(getComputedStyle(document.documentElement).fontSize);
    const screen: Screen = Screen.render({ "git.status": statusOf([conflictEntry("a.ts")], "f1").toJson(), "git.conflict": marked.toJson() });
    screen.element.style.height = "30rem";
    screen.element.style.width = "70rem";
    await screen.untilAsync(() => screen.texts(".markers .check-text").length > 0);
    const host: DOMRect = screen.element.getBoundingClientRect();
    const sides: DOMRect = screen.find(".sides").getBoundingClientRect();
    const view: HTMLElement = screen.viewElement;
    const detail: DOMRect = view.querySelector(".detail")?.getBoundingClientRect() ?? host;
    const title: DOMRect = view.querySelector(".checklist-title")?.getBoundingClientRect() ?? host;

    expect([screen.element.querySelectorAll("aside, .detail, .checklist, .detail-note").length, rem(host.right - sides.right)]).toEqual([0, 0.25]);
    expect([rem(title.left - detail.left), rem(title.top - detail.top), view.querySelector(".detail-note")?.textContent?.trim()])
      .toEqual([0.75, 0.75, "Resolutions are remembered (rerere), so the same conflict resolves itself the next time it comes up."]);
  });

  it("opens the Conflict view once, through openView only, when the document in front shows a file, and leaves it to the person after", async () => {
    const screen: Screen = Screen.render({
      "git.status": statusOf([conflictEntry("a.ts"), conflictEntry("c.ts")], "f1").toJson(),
      "git.conflict": () => (screen.requested("git.conflict").length > 1 ? bothC : marked).toJson()
    });
    await screen.untilAsync(() => screen.texts(".markers .check-text").length > 0);
    screen.find<HTMLButtonElement>(".file.conflicted:nth-of-type(2)").click();
    await vi.waitUntil(() => screen.requested("git.conflict").length > 1);

    expect([screen.context.callsOf("openView"), screen.context.callsOf("showView")]).toEqual([[["git.conflictDetail", "selected", "Conflict"]], []]);
  });

  it("follows the conflicts document in front, keeps its conflict while a document of another kind is, and empties once it closes or shows no file", async () => {
    const active: WritableSignal<boolean> = signal(true);
    let status: GitStatus = statusOf([conflictEntry("a.ts")], "f1");
    const screen: Screen = Screen.render({ "git.status": () => status.toJson(), "git.conflict": marked.toJson() }, GitFixtures.folder, [], active);
    const empty = (): readonly string[] => screen.texts(".empty-view");
    await screen.untilAsync(() => screen.texts(".markers .check-text").length > 0);
    const front: readonly string[] = [...empty(), ...screen.texts(".markers .check-text")];

    active.set(false);
    screen.view.detectChanges();
    const behind: readonly string[] = [...empty(), ...screen.texts(".markers .check-text")];
    active.set(true);
    status = statusOf([], "f2");
    await screen.state.refreshAsync();
    await screen.untilAsync(() => empty().length > 0);
    const noFile: readonly string[] = empty();
    status = statusOf([conflictEntry("a.ts")], "f3");
    await screen.state.refreshAsync();
    await screen.untilAsync(() => empty().length === 0);
    const again: readonly string[] = [...empty(), ...screen.texts(".checklist-title")];
    screen.fixture.destroy();
    screen.view.detectChanges();

    expect([front, behind, noFile, again, empty()]).toEqual([
      ["No conflict markers left in resolved files"], ["No conflict markers left in resolved files"],
      ["Open the conflicts of a merge or rebase to see the conflict here."], ["Before you commit"],
      ["Open the conflicts of a merge or rebase to see the conflict here."]
    ]);
  });

  it("checks before the commit that no file out of conflict keeps a conflict marker, leaving the files in conflict out", async () => {
    let leftover: readonly string[] = ["a.ts", "x.ts", "y.ts"];
    let reads = 0;
    const screen: Screen = Screen.render({
      "git.status": () => statusOf([conflictEntry("a.ts")], `f${++reads}`).toJson(), "git.conflict": marked.toJson(), "git.markerCheck": () => new GitMarkerCheck(leftover).toJson()
    });
    await screen.untilAsync(() => screen.texts(".markers .check-text").length > 0);
    const before: readonly string[] = screen.texts(".markers .check-text");

    leftover = ["a.ts"];
    await screen.state.refreshAsync();
    await screen.untilAsync(() => screen.texts(".markers .check-text")[0] !== before[0]);

    expect([screen.texts(".checklist-title"), before, screen.texts(".markers .check-text")]).toEqual([
      ["Before you commit"], ["Conflict markers left in x.ts and y.ts"], ["No conflict markers left in resolved files"]
    ]);
    expect(screen.requested("git.markerCheck")[0]).toEqual({ folder: GitFixtures.folder });
  });

  it("shows why the marker check failed, and keeps only the newest check's answer", async () => {
    let reads = 0;
    const screen: Screen = Screen.render({
      "git.status": () => statusOf([conflictEntry("a.ts")], `f${++reads}`).toJson(), "git.conflict": marked.toJson()
    }, GitFixtures.folder, ["git.markerCheck"]);
    const failure: Error = GitFixtures.failure(FailureCode.Git, null, "Git couldn't check.");
    const first: (answer: JsonValue | Error) => void = await screen.held.nextAsync("git.markerCheck");
    void screen.state.refreshAsync();
    const second: (answer: JsonValue | Error) => void = await screen.held.nextAsync("git.markerCheck");
    first(failure);
    second(new GitMarkerCheck(["x.ts"]).toJson());
    await screen.untilAsync(() => screen.texts(".markers .check-text").length > 0);
    const shown: readonly string[] = screen.texts(".markers .check-text");

    void screen.state.refreshAsync();
    const third: (answer: JsonValue | Error) => void = await screen.held.nextAsync("git.markerCheck");
    void screen.state.refreshAsync();
    const fourth: (answer: JsonValue | Error) => void = await screen.held.nextAsync("git.markerCheck");
    third(new GitMarkerCheck([]).toJson());
    fourth(failure);
    await screen.untilAsync(() => screen.texts(".markers .check-text")[0] !== shown[0]);

    expect([shown, screen.texts(".markers .check-text")]).toEqual([["Conflict markers left in x.ts"], ["The check for conflict markers failed: Git couldn't check."]]);
  });

  it("lists the first two files merged cleanly with a row that shows the rest", async () => {
    const clean: readonly StatusEntry[] = ["d.ts", "e.ts", "f.ts", "g.ts"].map(t => GitFixtures.entry(t, FileState.Modified, FileState.Unmodified));
    const screen: Screen = Screen.render({ "git.status": statusOf([conflictEntry("a.ts"), ...clean], "f1").toJson(), "git.conflict": marked.toJson() });
    await vi.waitUntil(() => screen.texts(".file.more").length > 0);
    const first: readonly string[] = [...screen.texts(".file.clean .name"), ...screen.texts(".file.more .name")];

    screen.find<HTMLButtonElement>(".file.more").click();
    await screen.untilAsync(() => screen.texts(".file.more").length === 0);

    expect([screen.texts(".group").at(-1), first, screen.texts(".file.clean .name"), screen.texts(".file.more")])
      .toEqual(["Merged cleanly 4", ["d.ts", "e.ts", "2 more"], ["d.ts", "e.ts", "f.ts", "g.ts"], []]);
  });

  it("offers a deleted side's file only whole: the other side or the deletion, with no take for the deleted side, and heads a side with no commit by its name alone", async () => {
    const screen: Screen = Screen.render({
      "git.status": statusOf([conflictEntry("a.ts", ConflictKind.DeletedByThem)], "f1").toJson(),
      "git.conflict": new GitConflict("a.ts", ConflictKind.DeletedByThem, OperationKind.Merge, "b\n", "ours\n", null, null, "main", "feature", `3b9f001${"0".repeat(33)}`, null, false,
        false).toJson(),
      "git.resolveConflict": null
    });
    await screen.untilAsync(() => !Object.isNull(screen.element.querySelector(".delete")));

    expect([screen.texts(".pane.ours .pane-head .label"), screen.texts(".pane.theirs .pane-head .label")]).toEqual([["main · 3b9f001"], ["feature"]]);

    expect([!Object.isNull(screen.element.querySelector(".take-ours")), screen.element.querySelector(".take-theirs")]).toEqual([true, null]);
    expect(screen.texts(".theirs .pane-note")).toEqual(["This side deleted the file."]);
    screen.find<HTMLButtonElement>(".delete").click();
    await GitFixtures.untilAsync(() => !screen.state.busy() && screen.requested("git.resolveConflict").length === 1);

    expect(screen.requested("git.resolveConflict")).toEqual([{ folder: GitFixtures.folder, path: "a.ts", resolution: ConflictResolution.Delete, text: null, basedOn: "f1" }]);
  });

  it("notes a binary file and a recorded resolution Git reused", async () => {
    const screen: Screen = Screen.render({
      "git.status": statusOf([conflictEntry("a.png"), conflictEntry("b.ts")], "f1").toJson(),
      "git.conflict": () => new GitConflict("a.png", ConflictKind.BothModified, OperationKind.Merge, null, null, null, null, "main", "feature", null, null, true, false).toJson()
    });
    await screen.untilAsync(() => !Object.isNull(screen.element.querySelector(".note-line")));

    expect(screen.texts(".note-line")).toEqual(["This file is binary: keep one side's whole file."]);
    expect([screen.element.querySelector(".code"), !Object.isNull(screen.element.querySelector(".take-ours")), screen.element.querySelector(".delete")]).toEqual([null, true, null]);
  });

  it("notes a reused resolution beside the file's sides", async () => {
    const screen: Screen = Screen.render({
      "git.status": statusOf([conflictEntry("a.ts")], "f1").toJson(),
      "git.conflict": new GitConflict("a.ts", ConflictKind.BothModified, OperationKind.Merge, "b\n", "o\n", "t\n", "r\n", "main", "feature", null, null, false, true).toJson()
    });
    await screen.untilAsync(() => !Object.isNull(screen.element.querySelector(".note-line")));

    expect(screen.texts(".note-line")).toEqual(["Git reused a recorded resolution of this conflict. Check it before you keep it."]);
  });

  it("shows why a conflict couldn't be read, reads it again on its row's click, and keeps the resolution out of Resolved when Git refuses it", async () => {
    let refuse: boolean = true;
    const screen: Screen = Screen.render({
      "git.status": statusOf([conflictEntry("a.ts")], "f1").toJson(),
      "git.conflict": () => refuse ? GitFixtures.failure(FailureCode.Git, null, "Git couldn't read the file.") : both.toJson(),
      "git.resolveConflict": GitFixtures.failure(FailureCode.Git, null, "Git refused the resolution.")
    });
    await screen.untilAsync(() => !Object.isNull(screen.element.querySelector(".sides .failure")));

    expect(screen.texts(".sides .failure")).toEqual(["Git couldn't read the file."]);
    refuse = false;
    screen.find<HTMLButtonElement>(".file.conflicted").click();
    await screen.untilAsync(() => !Object.isNull(screen.element.querySelector(".take-ours")));
    screen.find<HTMLButtonElement>(".take-ours").click();
    await screen.untilAsync(() => !Object.isNull(screen.element.querySelector(":scope > .failure")));

    expect([screen.texts(":scope > .failure"), screen.texts(".group")]).toEqual([["Git refused the resolution."], ["Conflicts 1"]]);
    expect(GitResolving.resolutionsOf(GitFixtures.folder).size).toBe(0);
  });

  it("shows the file picked last when an earlier pick's read answers after it, whether that read failed or not", async () => {
    const screen: Screen = Screen.render({ "git.status": statusOf([conflictEntry("a.ts"), conflictEntry("b.ts")], "f1").toJson() }, GitFixtures.folder, ["git.conflict"]);
    const conflictOf = (path: string): JsonValue =>
      new GitConflict(path, ConflictKind.BothModified, OperationKind.Merge, "base", `ours ${path}`, "theirs", "merged", "main", "feature", null, null, false, false).toJson();
    const pickAsync = async (index: number, reads: number): Promise<void> => {
      screen.find<HTMLButtonElement>(`.file.conflicted:nth-of-type(${index + 1})`).click();
      await vi.waitUntil(() => screen.requested("git.conflict").length === reads);
    };
    await vi.waitUntil(() => screen.requested("git.conflict").length === 1);

    await pickAsync(1, 2);
    await screen.held.answerAsync("git.conflict", GitFixtures.failure(FailureCode.Git, null, "Git couldn't read a.ts."));
    await screen.held.answerAsync("git.conflict", conflictOf("b.ts"));
    await vi.waitUntil(() => screen.sides().length > 0);
    const afterFailure: readonly (string | null)[] = [screen.sides()[0] ?? null, ...screen.texts(".sides .failure")];
    screen.find<HTMLButtonElement>(".file.selected").click();
    await pickAsync(0, 3);
    await pickAsync(1, 4);
    await screen.held.answerAsync("git.conflict", conflictOf("a.ts"));
    await screen.held.answerAsync("git.conflict", conflictOf("b.ts"));
    await GitFixtures.untilAsync(() => !screen.state.busy());
    await vi.waitUntil(() => screen.sides().length > 0);

    expect(afterFailure).toEqual(["ours b.ts"]);
    expect([screen.sides()[0], screen.texts(".file.selected .name")]).toEqual(["ours b.ts", ["b.ts"]]);
    expect(screen.requested("git.conflict")).toEqual(["a.ts", "b.ts", "a.ts", "b.ts"].map(path => ({ folder: GitFixtures.folder, path })));
  });

  it("colors the open file's code by its language in the merge editor, its base and a one-sided file's ours, loads one tokenizer a language, and leaves a file no language fits plain",
    async () => {
      const created = vi.spyOn(ShikiLineTokenizer, "createAsync");
      onTestFinished(() => created.mockRestore());
      const screen: Screen = Screen.render({ "git.status": statusOf([conflictEntry("a.ts"), conflictEntry("b.ts", ConflictKind.DeletedByThem), conflictEntry("c.cobol")], "f1").toJson() },
        GitFixtures.folder, ["git.conflict"]);
      const oursOf = (path: string): string => `const ours_${path.replace(".", "_")} = 1;\n`;
      const conflictOf = (path: string, kind: ConflictKind): JsonValue => kind === ConflictKind.DeletedByThem
        ? new GitConflict(path, kind, OperationKind.Merge, "const base = 0;\n", oursOf(path), null, null, "main", "feature", null, null, false, false).toJson()
        : new GitConflict(path, kind, OperationKind.Merge, "const base = 0;\n", oursOf(path), "const theirs = 2;\n",
          `<<<<<<< main\n${oursOf(path)}||||||| base\nconst base = 0;\n=======\nconst theirs = 2;\n>>>>>>> feature\n`, "main", "feature", null, null, false, false).toJson();
      const keywords = (selector: string): readonly string[] => screen.texts(`${selector} .nol-code-editor-token-keyword, ${selector} .nol-code-text-token-keyword`);
      const openAsync = async (index: number, path: string, kind: ConflictKind = ConflictKind.BothModified): Promise<void> => {
        if (index > 0)
          screen.find<HTMLButtonElement>(`.file.conflicted:nth-of-type(${index + 1})`).click();
        await vi.waitUntil(() => screen.requested("git.conflict").length === index + 1);
        await screen.held.answerAsync("git.conflict", conflictOf(path, kind));
        await screen.untilAsync(() => (screen.element.querySelector(".sides")?.textContent ?? "").includes(`ours_${path.replace(".", "_")}`));
      };

      await openAsync(0, "a.ts");
      screen.editor()?.nextConflict();
      await screen.untilAsync(() => keywords(".nol-merge-editor-result").length > 0 && keywords(".base-text").length > 0);
      const merged: readonly (readonly string[])[] = [keywords(".nol-merge-editor-side:first-child"), keywords(".base-text")];
      await openAsync(1, "b.ts", ConflictKind.DeletedByThem);
      await screen.untilAsync(() => keywords(".sides .code").length > 0);
      const oneSided: readonly string[] = keywords(".sides .code");
      await openAsync(2, "c.cobol");

      expect([merged, oneSided]).toEqual([[["const"], ["const"]], ["const"]]);
      expect([created.mock.calls, keywords(".sides").length, screen.texts(".nol-merge-editor-side:first-child .nol-code-editor-line").join(" ")])
        .toEqual([[["typescript"]], 0, expect.stringContaining("const ours_c_cobol")]);
    });

  it("leaves a file plain when its tokenizer loads after the file was left, and reports a tokenizer that fails to load", async () => {
    const handled: unknown[] = [];
    let finish: (tokenizer: ShikiLineTokenizer | null) => void = () => undefined;
    const late: Promise<ShikiLineTokenizer | null> = new Promise(resolve => {
      finish = resolve;
    });
    const broken: Error = new Error("The grammar didn't load.");
    const real: ShikiLineTokenizer | null = await ShikiLineTokenizer.createAsync("typescript");
    const created = vi.spyOn(ShikiLineTokenizer, "createAsync").mockReturnValueOnce(late).mockRejectedValueOnce(broken);
    onTestFinished(() => created.mockRestore());
    const screen: Screen = Screen.render({ "git.status": statusOf([conflictEntry("a.ts"), conflictEntry("c.cobol"), conflictEntry("d.py")], "f1").toJson() },
      GitFixtures.folder, ["git.conflict"]);
    vi.spyOn(TestBed.inject(ErrorHandler), "handleError").mockImplementation(error => handled.push(error));
    const conflictOf = (path: string): JsonValue =>
      new GitConflict(path, ConflictKind.BothModified, OperationKind.Merge, "b\n", "const ours = 1;\n", "const theirs = 2;\n", "const ours = 1;\n", "main", "feature", null, null, false, false).toJson();
    const tokens = (): number => screen.element.querySelectorAll("[class*='-token-']").length;
    await vi.waitUntil(() => screen.requested("git.conflict").length === 1);

    await screen.held.answerAsync("git.conflict", conflictOf("a.ts"));
    await vi.waitUntil(() => created.mock.calls.length === 1);
    screen.find<HTMLButtonElement>(".file.conflicted:nth-of-type(2)").click();
    await vi.waitUntil(() => screen.requested("git.conflict").length === 2);
    await screen.held.answerAsync("git.conflict", conflictOf("c.cobol"));
    await screen.untilAsync(() => screen.texts(".file.selected .name").join() === "c.cobol" && (screen.element.querySelector(".sides")?.textContent ?? "").includes("ours = 1"));
    finish(real);
    await late;
    await screen.fixture.whenStable();
    const afterLate: number = tokens();
    screen.find<HTMLButtonElement>(".file.conflicted:nth-of-type(3)").click();
    await vi.waitUntil(() => screen.requested("git.conflict").length === 3);
    await screen.held.answerAsync("git.conflict", conflictOf("d.py"));
    await vi.waitUntil(() => handled.length === 1);
    await screen.fixture.whenStable();

    expect([afterLate, handled, tokens()]).toEqual([0, [broken], 0]);
  });

  it("reports a resolution, a continue or an abort that fails other than by Git's refusal", async () => {
    const handled: unknown[] = [];
    let entries: readonly StatusEntry[] = [conflictEntry("a.ts")];
    const broken: Error = new Error("The channel closed.");
    const screen: Screen = Screen.render({
      "git.status": () => statusOf(entries, "f1").toJson(), "git.conflict": both.toJson(), "git.resolveConflict": broken, "git.continueOperation": broken,
      "git.abortOperation": broken
    });
    vi.spyOn(TestBed.inject(ErrorHandler), "handleError").mockImplementation(error => handled.push(error));
    await screen.untilAsync(() => !Object.isNull(screen.element.querySelector(".take-ours")));

    screen.find<HTMLButtonElement>(".take-ours").click();
    await vi.waitUntil(() => handled.length === 1);
    entries = [];
    await screen.state.refreshAsync();
    await screen.untilAsync(() => !screen.find<HTMLButtonElement>(".continue").disabled);
    screen.find<HTMLButtonElement>(".continue").click();
    await vi.waitUntil(() => handled.length === 2);
    screen.find<HTMLButtonElement>(".abort").click();
    await vi.waitUntil(() => handled.length === 3);

    expect(handled).toEqual([broken, broken, broken]);
    expect([GitResolving.resolutionsOf(GitFixtures.folder).size, screen.texts(":scope > .failure")]).toEqual([0, []]);
  });

  it("leads each file with its name and puts its folder after it, keeping the name whole in a narrow list, with the whole path as its title", async () => {
    const deep: string = "src/app/shared/forms/alt-ua/1/components/supplemental-disaster-declaration.component.html";
    const screen: Screen = Screen.render({
      "git.status": statusOf([conflictEntry(deep), GitFixtures.entry("top.ts", FileState.Modified, FileState.Unmodified)], "f1").toJson(),
      "git.conflict": new GitConflict(deep, ConflictKind.BothModified, OperationKind.Merge, "b\n", "o\n", "t\n", "m\n", "main", "feature", null, null, false, false).toJson()
    });
    await vi.waitUntil(() => screen.sides().length > 0);
    const row: HTMLElement = screen.find(".file.conflicted");
    row.style.width = "26rem";
    const name: HTMLElement = screen.find(".file.conflicted .name");
    const folder: HTMLElement = screen.find(".file.conflicted .folder");

    expect([screen.texts(".file .name"), screen.texts(".file .folder"), row.title, screen.find(".file.clean").title])
      .toEqual([["supplemental-disaster-declaration.component.html", "top.ts"], ["src/app/shared/forms/alt-ua/1/components", ""], deep, "top.ts"]);
    expect([name.scrollWidth <= name.clientWidth + 1, name.getBoundingClientRect().right <= folder.getBoundingClientRect().left + 1,
      folder.getBoundingClientRect().right <= row.getBoundingClientRect().right + 1]).toEqual([true, true, true]);

    row.style.width = "8rem";
    expect([folder.getBoundingClientRect().width, name.getBoundingClientRect().right <= row.getBoundingClientRect().right + 1]).toEqual([0, true]);
  });

  it("says no operation is in progress, and forgets the folder's resolutions once it ends", async () => {
    GitResolving.record(GitFixtures.folder, "a.ts", GitResolvedBy.Ours);
    const screen: Screen = Screen.render({ "git.status": statusOf([], "f1", null).toJson() });
    await screen.untilAsync(() => !Object.isNull(screen.element.querySelector(".quiet")));

    expect(screen.texts(".quiet")).toEqual(["No merge, rebase, cherry-pick or revert is in progress."]);
    expect(GitResolving.resolutionsOf(GitFixtures.folder).size).toBe(0);
  });

  it("offers nothing for a folder the Git panel doesn't follow while it's behind, and points the panel at its folder once it's the tab in front", async () => {
    const active: WritableSignal<boolean> = signal(false);
    const screen: Screen = Screen.render({ "git.status": statusOf([conflictEntry("a.ts")], "f1").toJson() }, "/work/other", [], active);
    await screen.untilAsync(() => !Object.isNull(screen.element.querySelector(".quiet")));

    expect([screen.texts(".quiet"), screen.element.querySelector("button"), screen.state.folder()])
      .toEqual([["Open this folder in the Git panel to resolve its conflicts."], null, GitFixtures.folder]);
    expect(screen.requested("git.conflict")).toEqual([]);

    active.set(true);
    await screen.untilAsync(() => Object.isNull(screen.element.querySelector(".quiet")));
    expect([screen.state.folder(), screen.texts(".quiet")]).toEqual(["/work/other", []]);

    const state: GitViewStateService = screen.state;
    screen.fixture.destroy();
    expect(state.folder()).toBe(GitFixtures.folder);
  });
});
