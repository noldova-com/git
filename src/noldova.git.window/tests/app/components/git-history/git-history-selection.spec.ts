/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ApplicationRef } from "@angular/core";
import { type ComponentFixture, TestBed } from "@angular/core/testing";
import { FakeWindowPartContext } from "@noldova/desktop.window/testing";
import { GitCommit, GitGraph, GitGraphCommit, GitRef, RefKind } from "@noldova/git.protocol";
import { LinkReferenceMatch } from "@noldova/ui.components.angular";
import { afterEach, describe, expect, it, onTestFinished } from "vitest";

import { GitHistoryComponent } from "../../../../src/app/components/git-history/git-history.component.ts";
import { GitHistoryAsks } from "../../../../src/app/services/git-history-asks.ts";
import { GitHistorySelection } from "../../../../src/app/services/git-history-selection.ts";
import { GitLinkReferences } from "../../../../src/app/services/git-link-references.ts";
import { GitViewing } from "../../../../src/app/services/git-viewing.ts";
import { GitFixtures } from "../../../fixtures/git-fixtures.fixture.ts";

function idOf(index: number): string {
  return index.toString(16).padStart(40, "0");
}

function commitAt(index: number): GitGraphCommit {
  return new GitGraphCommit(new GitCommit(idOf(index), [idOf(index + 1)], "Sample Author", "2026-11-06T17:30:00Z", `Commit ${index}`), "author@example.com",
    index === 1 ? [new GitRef(RefKind.Head, "main"), new GitRef(RefKind.Branch, "main")] : []);
}

const graph: GitGraph = new GitGraph(Array.from({ length: 300 }, (_, i) => commitAt(i + 1)), false);

async function untilAsync(done: () => boolean): Promise<void> {
  for (let tries = 0; !done() && tries < 200; tries++)
    await new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
}

function selectedOf(element: HTMLElement): string {
  return element.querySelector("[aria-selected=true] .message")?.textContent?.trim() ?? "";
}

function openHistory(context: FakeWindowPartContext): HTMLElement {
  GitFixtures.answerWith(context, { ...GitFixtures.watching, "git.status": GitFixtures.status().toJson(), "git.graph": graph.toJson() });
  GitFixtures.setUp(context);
  const fixture: ComponentFixture<GitHistoryComponent> = TestBed.createComponent(GitHistoryComponent);
  fixture.componentRef.setInput("instance", GitFixtures.folder);
  fixture.autoDetectChanges();
  const element: HTMLElement = fixture.nativeElement;
  element.style.width = "60rem";
  element.style.height = "20rem";
  return element;
}

describe("GitHistoryComponent selecting a commit another page asked for", () => {
  afterEach(() => GitViewing.commit.set(null));

  it("opens a reference in a commit's message, out of the list's tab order, without selecting the commit, while the rest of its row selects it", async () => {
    const opened: string[] = [];
    onTestFinished(GitLinkReferences.provide({
      referencesFor: () => ({ find: () => null, findText: t => t === "Commit 3" ? [new LinkReferenceMatch(7, 1, "https://example.com/issues/3")] : [] }),
      opens: (_folder, url) => opened.push(url) > 0
    }));
    const element: HTMLElement = openHistory(new FakeWindowPartContext());
    await untilAsync(() => element.querySelector(".message a") !== null);
    const link: HTMLAnchorElement | null = element.querySelector<HTMLAnchorElement>(".message a");
    const before: string = selectedOf(element);

    link?.click();
    await untilAsync(() => opened.length > 0);
    const afterLink: string = selectedOf(element);
    link?.closest(".message")?.querySelector<HTMLElement>("span")?.click();
    await untilAsync(() => selectedOf(element) === "Commit 3");

    expect([before === "Commit 3", afterLink === before, link?.getAttribute("tabindex"), opened, selectedOf(element)])
      .toEqual([false, true, "-1", ["https://example.com/issues/3"], "Commit 3"]);
  });

  it("opens the history through its command, then selects the commit and scrolls its row to the middle of the list", async () => {
    const context: FakeWindowPartContext = new FakeWindowPartContext();
    context.answer("runCommandAsync", () => Promise.resolve(null));

    await GitHistorySelection.selectAsync(context, GitFixtures.folder, idOf(200));
    const element: HTMLElement = openHistory(context);
    await untilAsync(() => selectedOf(element) === "Commit 200");
    await untilAsync(() => {
      const row: DOMRect | undefined = element.querySelector("[aria-selected=true]")?.getBoundingClientRect();
      const list: DOMRect | undefined = element.querySelector(".list")?.getBoundingClientRect();
      return row !== undefined && list !== undefined && row.top >= list.top && row.bottom <= list.bottom;
    });
    const row: DOMRect = element.querySelector("[aria-selected=true]")?.getBoundingClientRect() ?? new DOMRect();
    const list: DOMRect = element.querySelector(".list")?.getBoundingClientRect() ?? new DOMRect();

    expect(Math.abs(row.top + row.height / 2 - (list.top + list.height / 2))).toBeLessThanOrEqual(row.height);
    expect([context.callsOf("runCommandAsync"), GitViewing.commitOf(GitFixtures.folder)?.commit.commit.subject, GitHistoryAsks.askedOf(GitFixtures.folder),
      element.querySelector(".not-loaded")]).toEqual([[["git.openHistory", { folder: GitFixtures.folder }]], "Commit 200", null, null]);
  });

  it("selects a commit asked for in a hidden history, whose list never grows, and stops waiting to scroll it", async () => {
    const context: FakeWindowPartContext = new FakeWindowPartContext();
    context.answer("runCommandAsync", () => Promise.resolve(null));

    await GitHistorySelection.selectAsync(context, GitFixtures.folder, idOf(200));
    const element: HTMLElement = openHistory(context);
    element.style.display = "none";
    await untilAsync(() => GitViewing.commitOf(GitFixtures.folder)?.commit.commit.subject === "Commit 200");
    await TestBed.inject(ApplicationRef).whenStable();

    expect([GitViewing.commitOf(GitFixtures.folder)?.commit.commit.subject, element.querySelector(".list")?.scrollTop, GitHistoryAsks.askedOf(GitFixtures.folder)])
      .toEqual(["Commit 200", 0, null]);
  });

  it("selects a commit asked for while the history is already open", async () => {
    const context: FakeWindowPartContext = new FakeWindowPartContext();
    context.answer("runCommandAsync", () => Promise.resolve(null));
    const element: HTMLElement = openHistory(context);
    await untilAsync(() => selectedOf(element) === "Commit 1");

    await GitHistorySelection.selectAsync(context, GitFixtures.folder, idOf(3));
    await untilAsync(() => selectedOf(element) === "Commit 3");

    expect(GitViewing.commitOf(GitFixtures.folder)?.commit.commit.subject).toBe("Commit 3");
  });

  it("says a commit asked for isn't among the loaded commits, keeping the selection, until a row is chosen", async () => {
    const context: FakeWindowPartContext = new FakeWindowPartContext();
    context.answer("runCommandAsync", () => Promise.resolve(null));
    const element: HTMLElement = openHistory(context);
    await untilAsync(() => element.querySelectorAll("[role=option]").length > 0);

    await GitHistorySelection.selectAsync(context, GitFixtures.folder, "f".repeat(40));
    await untilAsync(() => element.querySelector(".not-loaded") !== null);
    const note: string = element.querySelector("[role=status].not-loaded")?.textContent?.trim() ?? "";
    const kept: boolean = selectedOf(element) === "Commit 1";
    element.querySelectorAll<HTMLElement>("[role=option]")[1]?.click();
    await untilAsync(() => element.querySelector(".not-loaded") === null);

    expect([note, kept, GitHistoryAsks.askedOf(GitFixtures.folder)]).toEqual(["Commit fffffff isn't among the history's loaded commits.", true, null]);
  });

  it("leaves a commit asked of another repository for that repository's history", async () => {
    const context: FakeWindowPartContext = new FakeWindowPartContext();
    context.answer("runCommandAsync", () => Promise.resolve(null));
    const element: HTMLElement = openHistory(context);
    await untilAsync(() => element.querySelectorAll("[role=option]").length > 0);

    await GitHistorySelection.selectAsync(context, "/work/other", idOf(3));
    const asked = GitHistoryAsks.askedOf("/work/other");
    if (asked !== null)
      GitHistoryAsks.take(asked);

    expect([asked?.commitId, selectedOf(element) === "Commit 3", element.querySelector(".not-loaded")]).toEqual([idOf(3), false, null]);
  });
});
