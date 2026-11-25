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
import { LinkPlace } from "@noldova/desktop.window";
import { FakeWindowPartContext } from "@noldova/desktop.window/testing";
import { FailureCode, FileState, GitCommit, GitGraph, GitGraphCommit, GitPrediction, GitRef, GitRemote, PredictionOutcome, RefKind, RemoteTransport } from "@noldova/git.protocol";
import { describe, expect, it, onTestFinished, vi } from "vitest";

import { GitHistoryComponent } from "../../../../src/app/components/git-history/git-history.component.ts";
import { GitPullRequests } from "../../../../src/app/services/git-pull-requests.ts";
import { GitRebaseTarget, GitRebasing } from "../../../../src/app/services/git-rebasing.ts";
import { GitFixtures } from "../../../fixtures/git-fixtures.fixture.ts";
import { GitHeldRequests } from "../../../fixtures/git-held-requests.fixture.ts";

/** A mounted history, with the errors it reported. */
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

describe("GitHistoryComponent branch drops", () => {
  const commitOf = (id: string, parents: readonly string[], subject: string, refs: readonly GitRef[] = []): GitGraphCommit =>
    new GitGraphCommit(new GitCommit(id.repeat(40), parents.map(t => t.repeat(40)), "Sample Author", "2026-11-06T17:30:00Z", subject), "author@example.com", refs);
  const graph: GitGraph = new GitGraph([
    commitOf("a", ["b"], "Second", [new GitRef(RefKind.Head, "main"), new GitRef(RefKind.Branch, "main"), new GitRef(RefKind.Tag, "v1")]),
    commitOf("b", ["c"], "First", [new GitRef(RefKind.Branch, "feature"), new GitRef(RefKind.RemoteBranch, "origin/feature")]),
    commitOf("c", [], "Start", [new GitRef(RefKind.Branch, "topic"), new GitRef(RefKind.RemoteBranch, "origin/other")])
  ], false);
  const clean: JsonValue = new GitPrediction(PredictionOutcome.Clean, []).toJson();

  const mount = (context: FakeWindowPartContext): MountedHistory => {
    GitFixtures.setUp(context);
    const handled: WritableSignal<string[]> = signal<string[]>([]);
    vi.spyOn(TestBed.inject(ErrorHandler), "handleError").mockImplementation(error => handled.update(t => [...t, String(error)]));
    const fixture: ComponentFixture<GitHistoryComponent> = TestBed.createComponent(GitHistoryComponent);
    fixture.componentRef.setInput("instance", GitFixtures.folder);
    fixture.autoDetectChanges();
    return new MountedHistory(fixture, fixture.nativeElement, handled);
  };
  const chip = (element: HTMLElement, name: string): HTMLElement =>
    [...element.querySelectorAll<HTMLElement>(".chip")].find(t => t.querySelector(".ellipsis")?.textContent === name) ?? element.ownerDocument.createElement("span");
  /** Drags one chip onto another, at the given point; whether the target took the drag over, and whether it took the drop. */
  const drag = (element: HTMLElement, from: string, to: string, at: DOMPoint = new DOMPoint(200, 150)): readonly boolean[] => {
    chip(element, from).dispatchEvent(new DragEvent("dragstart", { bubbles: true }));
    const over: DragEvent = new DragEvent("dragover", { bubbles: true, cancelable: true });
    chip(element, to).dispatchEvent(over);
    const dropped: DragEvent = new DragEvent("drop", { bubbles: true, cancelable: true, clientX: at.x, clientY: at.y });
    chip(element, to).dispatchEvent(dropped);
    return [over.defaultPrevented, dropped.defaultPrevented];
  };
  const until = (done: () => boolean): Promise<boolean> => vi.waitUntil(done, { timeout: 5000 });
  /** The element's text, its children's texts apart by a space. */
  const text = (element: HTMLElement, selector: string): string => {
    const found: Element | null = element.querySelector(selector);
    const parts: string[] = Object.isNull(found) ? [] : found.children.length === 0 ? [found.textContent ?? ""] : [...found.children].map(t => t.textContent ?? "");
    return parts.map(t => t.trim()).filter(t => t.length > 0).join(" ");
  };
  const readyAsync = (element: HTMLElement, context: FakeWindowPartContext): Promise<boolean> =>
    until(() => element.querySelectorAll(".chip").length > 0 && context.callsOf("requestAsync").some(t => t[0] === "git.status"));

  it("drags only branch chips, drops on another branch's chip, and merges the dropped branch into the current one on its status", async () => {
    const context: FakeWindowPartContext = new FakeWindowPartContext();
    GitFixtures.answerWith(context, { ...GitFixtures.watching, "git.graph": graph.toJson(), "git.status": GitFixtures.status().toJson(), "git.predict": clean, "git.merge": null });
    const { element } = mount(context);
    await readyAsync(element, context);
    await until(() => chip(element, "main").getAttribute("draggable") === "true");

    expect(["main", "feature", "origin/other", "v1"].map(t => chip(element, t).getAttribute("draggable"))).toEqual(["true", "true", "true", "false"]);
    expect(drag(element, "feature", "main", new DOMPoint(240, 160))).toEqual([true, true]);
    await until(() => text(element, ".heading") === "check_circle No conflicts predicted");
    const box: DOMRect = element.querySelector(".drop")?.getBoundingClientRect() ?? new DOMRect();
    expect([box.left, box.top, context.callsOf("requestAsync").filter(t => t[0] === "git.predict").map(t => t[1])]).toEqual([
      240, 160, [{ folder: GitFixtures.folder, id: "b".repeat(40), action: "Merge" }]
    ]);
    element.querySelector<HTMLButtonElement>(".option.merge")?.click();
    await until(() => context.callsOf("requestAsync").some(t => t[0] === "git.merge") && Object.isNull(element.querySelector(".drop")));

    expect([context.callsOf("requestAsync").find(t => t[0] === "git.merge")?.[1], element.querySelector(".drop")]).toEqual([
      { folder: GitFixtures.folder, id: "b".repeat(40), basedOn: "f1" }, null
    ]);
  });

  it("opens the host's page for a pull request of a branch its remote holds into the target, reporting a page that won't open, and holds the choice for a branch it doesn't hold", async () => {
    const context: FakeWindowPartContext = new FakeWindowPartContext();
    const remote: GitRemote = new GitRemote("origin", "github.com", "octocat/site", RemoteTransport.Https);
    const asked: string[] = [];
    onTestFinished(GitPullRequests.provide(new FakeWindowPartContext(), {
      claims: t => t.host === "github.com", hostName: "GitHub", signInPage: "git-github.account", listFor: () => signal(null), refresh: () => undefined,
      newPullRequestUrl: (shown, source, target) => {
        asked.push(`${shown.path ?? ""} ${source} ${target}`);
        return `https://example.com/${source}...${target}`;
      }
    }));
    GitFixtures.answerWith(context, { ...GitFixtures.watching, "git.graph": graph.toJson(), "git.status": GitFixtures.status([], null, { remote }).toJson(), "git.predict": clean });
    context.answer("openLinkAsync", () => Promise.reject(new Error("no browser")));
    const { element, handled } = mount(context);
    await readyAsync(element, context);

    drag(element, "topic", "main");
    await until(() => !Object.isNull(element.querySelector(".option.request")));
    const held: readonly unknown[] = [element.querySelector<HTMLButtonElement>(".option.request")?.disabled,
      element.querySelector<HTMLButtonElement>(".option.request")?.title];
    element.querySelector<HTMLElement>(".backdrop")?.click();
    await until(() => Object.isNull(element.querySelector(".drop")));
    drag(element, "feature", "main");
    await until(() => !Object.isNull(element.querySelector(".option.request:enabled")));
    element.querySelector<HTMLButtonElement>(".option.request")?.click();
    await until(() => handled().length > 0 && Object.isNull(element.querySelector(".drop")));

    expect([held, asked, context.callsOf("openLinkAsync"), handled()]).toEqual([
      [true, "Push topic to a remote whose host opens pull requests to open one into main"], ["octocat/site feature main"],
      [["https://example.com/feature...main", { place: LinkPlace.System }]], ["Error: no browser"]
    ]);
  });

  it("opens the rebase screen for the current branch dropped on another, onto that branch's commit", async () => {
    const context: FakeWindowPartContext = new FakeWindowPartContext();
    GitFixtures.answerWith(context, { ...GitFixtures.watching, "git.graph": graph.toJson(), "git.status": GitFixtures.status().toJson(), "git.predict": clean });
    context.allow("openDocument");
    onTestFinished(() => GitRebasing.forget(GitFixtures.folder));
    const { element } = mount(context);
    await readyAsync(element, context);

    drag(element, "main", "topic");
    await until(() => !Object.isNull(element.querySelector(".option.rebase:enabled")));
    element.querySelector<HTMLButtonElement>(".option.rebase")?.click();
    await until(() => Object.isNull(element.querySelector(".drop")));

    expect([GitRebasing.targetOf(GitFixtures.folder), context.callsOf("openDocument"), element.querySelector(".drop")]).toEqual([
      new GitRebaseTarget("c".repeat(40), "topic"), [["git.interactiveRebase", GitFixtures.folder, expect.any(String)]], null
    ]);
  });

  it("predicts nothing between two branches that aren't current, and ignores a drop on the same branch, a tag, without a drag, or after the drag ended", async () => {
    const context: FakeWindowPartContext = new FakeWindowPartContext();
    GitFixtures.answerWith(context, { ...GitFixtures.watching, "git.graph": graph.toJson(), "git.status": GitFixtures.status().toJson(), "git.predict": clean });
    const { element } = mount(context);
    await readyAsync(element, context);

    expect(drag(element, "feature", "feature")).toEqual([false, false]);
    expect(drag(element, "feature", "v1")).toEqual([false, false]);
    expect(drag(element, "v1", "main")).toEqual([false, false]);
    chip(element, "feature").dispatchEvent(new DragEvent("dragstart", { bubbles: true }));
    chip(element, "feature").dispatchEvent(new DragEvent("dragend", { bubbles: true }));
    const late: DragEvent = new DragEvent("drop", { bubbles: true, cancelable: true });
    chip(element, "main").dispatchEvent(late);
    expect([late.defaultPrevented, element.querySelector(".drop")]).toEqual([false, null]);

    drag(element, "feature", "topic");
    await until(() => !Object.isNull(element.querySelector(".drop")));
    expect([text(element, ".detail"), context.callsOf("requestAsync").filter(t => t[0] === "git.predict")]).toEqual([
      "Switch to feature or topic to see what a merge of the two would do.", []
    ]);
    element.querySelector<HTMLElement>(".backdrop")?.click();
    await until(() => Object.isNull(element.querySelector(".drop")));
  });

  it("switches to a local branch that isn't current and merges the dropped one into it once asked, on each step's own status, and does nothing when cancelled", async () => {
    const context: FakeWindowPartContext = new FakeWindowPartContext();
    let switched: boolean = false;
    GitFixtures.answerWith(context, { ...GitFixtures.watching, "git.graph": graph.toJson(), "git.predict": clean, "git.merge": null,
      "git.switchBranch": () => {
        switched = true;
        return null;
      },
      "git.status": () => (switched ? GitFixtures.status([], null, { branch: "topic", fingerprint: "f2" }) : GitFixtures.status()).toJson() });
    const { element } = mount(context);
    await readyAsync(element, context);
    const dialog = (): HTMLElement | null => document.querySelector("nol-git-switch-merge-dialog");
    const requested = (method: string): readonly unknown[] => context.callsOf("requestAsync").filter(t => t[0] === method).map(t => t[1]);
    const askAsync = async (): Promise<void> => {
      drag(element, "feature", "topic");
      await until(() => !Object.isNull(element.querySelector(".drop")));
      element.querySelector<HTMLButtonElement>(".option.merge")?.click();
      await until(() => (dialog()?.querySelector(".text")?.textContent ?? "").length > 0 && Object.isNull(element.querySelector(".drop")));
    };

    await askAsync();
    const asked: readonly unknown[] = [element.querySelector(".drop"), dialog()?.querySelector(".text")?.textContent?.trim()];
    dialog()?.querySelector<HTMLButtonElement>(".cancel")?.click();
    await until(() => Object.isNull(dialog()));
    const cancelled: readonly unknown[] = [requested("git.switchBranch"), requested("git.merge")];
    await askAsync();
    dialog()?.querySelector<HTMLButtonElement>(".switch-merge")?.click();
    await until(() => requested("git.merge").length > 0);

    expect(asked).toEqual([null, "Git first switches to topic, then merges feature into it. You stay on topic afterwards."]);
    expect(cancelled).toEqual([[], []]);
    expect([requested("git.switchBranch"), requested("git.merge")]).toEqual([[{ folder: GitFixtures.folder, name: "topic", basedOn: "f1" }],
      [{ folder: GitFixtures.folder, id: "b".repeat(40), basedOn: "f2" }]]);
  });

  it("switches nothing to merge while the folder has local changes, and says so", async () => {
    const context: FakeWindowPartContext = new FakeWindowPartContext();
    GitFixtures.answerWith(context, { ...GitFixtures.watching, "git.graph": graph.toJson(), "git.predict": clean,
      "git.status": GitFixtures.status([GitFixtures.entry("a.ts", FileState.Unmodified, FileState.Modified)]).toJson() });
    const { element } = mount(context);
    await readyAsync(element, context);

    drag(element, "feature", "topic");
    await until(() => !Object.isNull(element.querySelector(".drop")));
    element.querySelector<HTMLButtonElement>(".option.merge")?.click();
    await until(() => !Object.isNull(element.querySelector("[role=alert]")));

    expect([element.querySelector("[role=alert]")?.textContent?.trim(), document.querySelector("nol-git-switch-merge-dialog"), element.querySelector(".drop"),
      context.callsOf("requestAsync").filter(t => t[0] === "git.switchBranch")])
      .toEqual(["Commit or stash your changes first: switching to topic to merge would carry them along.", null, null, []]);
  });

  it("takes no drop before the status is read, drops a prediction for a closed dialog, and reports one that fails outside Git", async () => {
    const context: FakeWindowPartContext = new FakeWindowPartContext();
    const held: GitHeldRequests = new GitHeldRequests(context, ["git.status", "git.predict"], { ...GitFixtures.watching, "git.graph": graph.toJson() });
    const { element, handled } = mount(context);
    await until(() => element.querySelectorAll(".chip").length > 0);

    expect(drag(element, "feature", "main")).toEqual([true, false]);
    await held.answerAsync("git.status", GitFixtures.status().toJson());
    await until(() => drag(element, "feature", "main")[1] === true);
    await until(() => !Object.isNull(element.querySelector(".drop")));
    element.querySelector<HTMLElement>(".backdrop")?.click();
    await held.answerAsync("git.predict", clean);
    await until(() => Object.isNull(element.querySelector(".drop")));

    drag(element, "feature", "main");
    await held.answerAsync("git.predict", GitFixtures.failure(FailureCode.Git, null, "Git can't tell."));
    await until(() => text(element, ".detail") !== "" && Object.isNull(element.querySelector(".heading")));
    drag(element, "main", "feature");
    await held.answerAsync("git.predict", new Error("predict broke"));
    await until(() => handled().includes("Error: predict broke"));

    expect([handled(), element.querySelector(".heading")]).toEqual([["Error: predict broke"], null]);
  });
});
