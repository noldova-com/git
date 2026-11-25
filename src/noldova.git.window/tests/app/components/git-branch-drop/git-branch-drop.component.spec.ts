/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { type ComponentFixture, TestBed } from "@angular/core/testing";
import "@noldova/context.core";
import { GitPrediction, PredictionOutcome } from "@noldova/git.protocol";
import { describe, expect, it } from "vitest";

import { GitBranchDropComponent } from "../../../../src/app/components/git-branch-drop/git-branch-drop.component.ts";
import { GitBranchDrop } from "../../../../src/app/models/git-branch-drop.ts";

/** A rendered drop panel, with the events it sent, in order. */
class RenderedDrop {
  public readonly fixture: ComponentFixture<GitBranchDropComponent>;
  public readonly element: HTMLElement;
  public readonly events: string[];

  public constructor(fixture: ComponentFixture<GitBranchDropComponent>, element: HTMLElement, events: string[]) {
    this.fixture = fixture;
    this.element = element;
    this.events = events;
  }
}

describe("GitBranchDropComponent", () => {
  const a: string = "a".repeat(40);
  const b: string = "b".repeat(40);
  const intoMain: GitBranchDrop = new GitBranchDrop("feature", b, "main", a, "main", true);

  const render = (drop: GitBranchDrop, prediction: GitPrediction | null, checking: boolean = false, busy: boolean = false, request: string | null = null):
  RenderedDrop => {
    const fixture: ComponentFixture<GitBranchDropComponent> = TestBed.createComponent(GitBranchDropComponent);
    const events: string[] = [];
    fixture.componentRef.setInput("drop", drop);
    fixture.componentRef.setInput("prediction", prediction);
    fixture.componentRef.setInput("checking", checking);
    fixture.componentRef.setInput("busy", busy);
    fixture.componentRef.setInput("request", request);
    fixture.componentRef.setInput("left", 120);
    fixture.componentRef.setInput("top", 80);
    fixture.componentInstance.merged.subscribe(() => events.push("merged"));
    fixture.componentInstance.rebased.subscribe(() => events.push("rebased"));
    fixture.componentInstance.switchMerged.subscribe(() => events.push("switchMerged"));
    fixture.componentInstance.closed.subscribe(() => events.push("closed"));
    fixture.componentInstance.requested.subscribe(t => events.push("requested " + t));
    fixture.autoDetectChanges();
    return new RenderedDrop(fixture, fixture.nativeElement, events);
  };
  /** The element's text, its children's texts apart by a space. */
  const text = (element: HTMLElement, selector: string): string => {
    const found: Element | null = element.querySelector(selector);
    const parts: string[] = Object.isNull(found) ? [] : found.children.length === 0 ? [found.textContent ?? ""] : [...found.children].map(t => t.textContent ?? "");
    return parts.map(t => t.trim()).filter(t => t.length > 0).join(" ");
  };
  const option = (element: HTMLElement, name: string): HTMLButtonElement => element.querySelector<HTMLButtonElement>(`.option.${name}`) ?? document.createElement("button");

  it("says no conflicts are predicted where the drop landed, offers the merge into the current branch first and focuses it, and emits the choice", async () => {
    const { fixture, element, events } = render(intoMain, new GitPrediction(PredictionOutcome.Clean, []));
    await fixture.whenStable();
    const box: DOMRect = element.querySelector(".drop")?.getBoundingClientRect() ?? new DOMRect();

    expect([text(element, ".heading"), text(element, ".detail"), element.querySelector("[role=dialog]")?.getAttribute("aria-label")]).toEqual([
      "check_circle No conflicts predicted", "Checked against main without touching your files.", "Drop feature on main"
    ]);
    expect([box.left, box.top, box.width / parseFloat(getComputedStyle(document.documentElement).fontSize)]).toEqual([120, 80, 24]);
    expect([option(element, "merge").disabled, option(element, "rebase").disabled, option(element, "request").disabled, document.activeElement]).toEqual([
      false, true, true, option(element, "merge")
    ]);
    expect([option(element, "rebase").title, option(element, "request").title]).toEqual(["Switch to feature to rebase it",
      "Push feature to a remote whose host opens pull requests to open one into main"]);
    option(element, "merge").click();
    expect(events).toEqual(["merged"]);
  });

  it("offers the pull request into the target where its host has a page for it, and emits that page", async () => {
    const page: string = "https://example.com/compare/main...feature";
    const { fixture, element, events } = render(intoMain, null, false, false, page);
    await fixture.whenStable();

    expect([option(element, "request").disabled, option(element, "request").title]).toEqual([false, "Open a pull request into main"]);
    option(element, "request").click();
    expect(events).toEqual(["requested " + page]);
  });

  it("offers the rebase of the current branch, with the conflicts a merge of the two would have", async () => {
    const { fixture, element, events } = render(new GitBranchDrop("main", a, "feature", b, "main", true), new GitPrediction(PredictionOutcome.Conflicts, ["a.ts", "b.ts", "c.ts", "d.ts"]));
    await fixture.whenStable();

    expect([text(element, ".heading"), text(element, ".detail"), option(element, "merge").title, document.activeElement]).toEqual([
      "warning Conflicts predicted in four files: a.ts, b.ts, c.ts and one more", "Checked against main without touching your files.", "Switch to feature and merge main",
      option(element, "rebase")
    ]);
    option(element, "rebase").click();
    expect(events).toEqual(["rebased"]);
  });

  it("says when the merge is already done, a fast-forward, still being read, or one Git can't tell", () => {
    const headings: string[] = [
      render(intoMain, new GitPrediction(PredictionOutcome.UpToDate, [])),
      render(intoMain, new GitPrediction(PredictionOutcome.FastForward, [])),
      render(intoMain, null, true),
      render(intoMain, new GitPrediction(PredictionOutcome.Unavailable, [])),
      render(intoMain, null)
    ].map(t => text(t.element, ".heading"));

    expect(headings).toEqual(["check_circle Already merged", "check_circle No conflicts predicted", "progress_activity Checking for conflicts…", "", ""]);
    expect(text(render(new GitBranchDrop("feature", a, "conflicts", "1", "main", true), new GitPrediction(PredictionOutcome.Conflicts, ["a.ts"])).element, ".heading"))
      .toBe("warning Conflicts predicted in one file: a.ts");
  });

  it("holds the merge while a write runs, says to switch when neither branch is current, and says when both point at the same commit", async () => {
    const busy = render(intoMain, null, false, true);
    const elsewhere = render(new GitBranchDrop("feature", b, "origin/topic", a, "main", false), null);
    await elsewhere.fixture.whenStable();

    expect(option(busy.element, "merge").disabled).toBe(true);
    expect([text(elsewhere.element, ".detail"), document.activeElement === elsewhere.element.ownerDocument.body]).toEqual([
      "Switch to feature or origin/topic to see what a merge of the two would do.", true
    ]);
    expect(text(render(new GitBranchDrop("feature", a, "main", a, "main", true), null).element, ".detail")).toBe("Both point at the same commit.");
  });

  it("offers the merge into a local branch that isn't current with the switch to it first, focusing it when nothing else runs, and holds it for a remote branch", async () => {
    const { fixture, element, events } = render(new GitBranchDrop("feature", b, "topic", a, "main", true), null);
    await fixture.whenStable();
    const local: readonly unknown[] = [text(element, ".merge"), option(element, "merge").title, option(element, "merge").disabled,
      document.activeElement === option(element, "merge")];
    const remote = render(new GitBranchDrop("feature", b, "origin/topic", a, "main", false), null);

    expect(local).toEqual(["merge Switch to topic and merge feature", "Switch to topic and merge feature", false, true]);
    expect([text(remote.element, ".merge"), option(remote.element, "merge").title, option(remote.element, "merge").disabled])
      .toEqual(["merge Merge feature into origin/topic", "Switch to origin/topic to merge into it", true]);
    option(element, "merge").click();
    expect(events).toEqual(["switchMerged"]);
  });

  it("closes on Escape, a click beside it, or a right-click beside it", () => {
    const { element, events } = render(intoMain, null);

    element.querySelector(".drop")?.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    element.querySelector<HTMLElement>(".backdrop")?.click();
    const right: MouseEvent = new MouseEvent("contextmenu", { bubbles: true, cancelable: true });
    element.querySelector(".backdrop")?.dispatchEvent(right);

    expect([events, right.defaultPrevented]).toEqual([["closed", "closed", "closed"], true]);
  });
});
