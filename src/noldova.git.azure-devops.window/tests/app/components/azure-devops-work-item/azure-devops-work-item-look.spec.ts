/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type {} from "@vitest/browser-playwright";
import { Component, signal } from "@angular/core";
import { type ComponentFixture, TestBed } from "@angular/core/testing";
import "@noldova/context.core";
import { WindowPartTokens } from "@noldova/desktop.window";
import { FakeWindowPartContext } from "@noldova/desktop.window/testing";
import { AzureDevOpsNames } from "@noldova/git.azure-devops.protocol";
import { HostAvatar, HostChanges, HostItem, HostPerson, HostPolicy, HostPullRequest, HostReference, HostSignIn, HostWorkItem, HostWorkItemDetail, HostWorkItemList, HostWorkItemType, PolicyState,
  ReferenceKind, ReferenceState, WorkItemCategory } from "@noldova/git.hosting.protocol";
import { GitCommit, GitGraph, GitGraphCommit, GitMessageReferences, GitNames, GitRemote, GitStatus, RemoteTransport } from "@noldova/git.protocol";
import { GitFolder } from "@noldova/git.window";
import { DefaultTheme, ThemeMode } from "@noldova/ui.components.angular";
import { AppearanceFixture } from "@noldova/ui.components.angular/testing";
import { afterEach, describe, expect, it, onTestFinished } from "vitest";
import { page } from "vitest/browser";

import { GitLayout } from "../../../../../noldova.git.window/tests/fixtures/git-layout.fixture.ts";
import { AzureDevOpsWorkItemComponent } from "../../../../src/app/components/azure-devops-work-item/azure-devops-work-item.component.ts";
import { AzureDevOpsWorkItemDetailComponent } from "../../../../src/app/components/azure-devops-work-item-detail/azure-devops-work-item-detail.component.ts";
import { RequestAnswers } from "../../../fixtures/request-answers.fixture.ts";

@Component({
  selector: "nol-git-azure-devops-document",
  imports: [AzureDevOpsWorkItemComponent, AzureDevOpsWorkItemDetailComponent],
  template: "<div class=\"window\"><div class=\"document\"><nol-git-azure-devops-work-item instance=\"fabrikam/Sample%20Project/7521\" /></div>"
    + "<div class=\"dock\"><nol-git-azure-devops-work-item-detail instance=\"selected\" /></div></div>",
  styles: [
    ".window { display: flex; height: 40rem; color: var(--nol-text); font-family: var(--nol-font-sans); font-size: var(--nol-text-panel);"
    + " line-height: var(--nol-line-panel); }",
    ".document { box-sizing: border-box; flex: none; width: 44rem; height: 100%; }",
    ".dock { box-sizing: border-box; flex: none; width: 22rem; height: 100%; }"
  ]
})
class DocumentComponent {
}

const HOST: string = "git-azure-devops";
const REPOSITORY: string = "3f2504e0-4f89-11d3-9a0c-0305e82c3301";
const screenshots: string = "../../../../../../_build/azure-devops-window/screenshots";
const story: HostWorkItemType = new HostWorkItemType("User Story", "009CCC", "icon_book");
const task: HostWorkItemType = new HostWorkItemType("Task", "F2CB1D", "icon_clipboard");
const pr482: HostReference = new HostReference(HOST, "fabrikam", REPOSITORY, 752);

function itemOf(id: number, type: HostWorkItemType, title: string, state: string, category: WorkItemCategory, parent: number | null): HostWorkItem {
  return new HostWorkItem(HOST, "fabrikam", "Sample Project", id, type, title, state, category,
    `https://dev.azure.com/fabrikam/Sample%20Project/_workitems/edit/${id}`, new HostPerson("kim@fabrikam.test", null, null), "Sample Project\\Sprint 17",
    "Sample Project\\Notes app", parent);
}

const mine: readonly HostWorkItemDetail[] = [
  new HostWorkItemDetail(itemOf(7402, new HostWorkItemType("Epic", "FF7B00", "icon_crown"), "Note sharing and sync", "Active", WorkItemCategory.InProgress,
    null), null, null, null, null, null, [7490], [], 0, []),
  new HostWorkItemDetail(itemOf(7490, new HostWorkItemType("Feature", "773B93", "icon_trophy"), "Markdown export", "Active", WorkItemCategory.InProgress,
    7402), null, null, null, null, null, [7521], [], 0, []),
  new HostWorkItemDetail(itemOf(7521, story, "Export notes as Markdown files", "Active", WorkItemCategory.InProgress, 7490), 5, null, null, null,
    "Readers see a due date 48 h and 2 h before it is due. No export runs during the user's local night hours.", [7530, 7531], [pr482], 5,
    ["users/kim/7521-export-notes-markdown"]),
  new HostWorkItemDetail(itemOf(7530, task, "Note card with tag chips, with a title long enough to run past its column so the row cuts it short", "Closed",
    WorkItemCategory.Completed, 7521), null, 0, 6, null, null, [], [], 3, []),
  new HostWorkItemDetail(itemOf(7531, task, "Read local times from the app settings", "New", WorkItemCategory.Proposed, 7521), null, 2, 2, null, null, [], [],
    0, [])
];
const pullRequest: HostPullRequest = new HostPullRequest(new HostItem(pr482, ReferenceKind.PullRequest, ReferenceState.Open, "Export notes",
  "https://dev.azure.com/fabrikam/Sample%20Project/_git/garden-web/pullrequest/752", null, 1_800_000_000_000, null, 0, 
  HostChanges.uncounted("users/kim/7521-export-notes-markdown", "main", "0123456789abcdef0123456789abcdef01234567")), [],
[new HostPolicy("Build", PolicyState.Approved, true, null), new HostPolicy("Comments", PolicyState.Rejected, true, null)], [], false, "", null, []);

const history: GitGraph = new GitGraph([
  new GitGraphCommit(new GitCommit("a91c40e".padEnd(40, "0"), [], "Mona Lisa", "2026-11-22T10:00:00Z",
    "Show the note card with its tag chip choices, with a subject long enough to run past the row so the row cuts it short #7521"), "kim@fabrikam.test", []),
  new GitGraphCommit(new GitCommit("5f02b7d".padEnd(40, "0"), [], "Mona Lisa", "2026-11-22T08:00:00Z", "Local times AB#7521"),
    "kim@fabrikam.test", [])
], true);

const picture: string = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=";

async function openAsync(mode: ThemeMode, withHistory: boolean = false, withPicture: boolean = false): Promise<ComponentFixture<DocumentComponent>> {
  AppearanceFixture.apply(DefaultTheme.theme, mode);
  const context = new FakeWindowPartContext();
  const requests = new RequestAnswers(context);
  requests.answer(AzureDevOpsNames.readWorkItemsMethod, new HostWorkItemList(mine, false).toJson(), new HostWorkItemList(mine.slice(3), false).toJson());
  requests.answer(AzureDevOpsNames.readPullRequestMethod, pullRequest.toJson());
  if (withPicture)
    requests.answer(AzureDevOpsNames.readPersonAvatarMethod, new HostAvatar(picture).toJson());
  if (withHistory) {
    onTestFinished(GitFolder.provide(new FakeWindowPartContext(), signal("/work/garden-web")));
    requests.answer(GitNames.statusMethod, new GitStatus("main", "a".repeat(40), null, [], false, "f1", null,
      new GitRemote("origin", "dev.azure.com", "fabrikam/Sample%20Project/_git/garden-web", RemoteTransport.Https)).toJson());
    requests.answer(GitNames.graphMethod, history.toJson());
    requests.answer(GitNames.messageReferencesMethod, new GitMessageReferences([], false).toJson());
  }
  TestBed.configureTestingModule({ providers: [{ provide: WindowPartTokens.context, useValue: context },
    { provide: WindowPartTokens.activeDocument, useValue: signal(true) }] });
  const fixture = TestBed.createComponent(DocumentComponent);
  fixture.autoDetectChanges();
  await requests.askedAsync(withHistory ? 5 : 3);
  await fixture.whenStable();
  fixture.detectChanges();
  await fixture.whenStable();
  return fixture;
}

function find(root: HTMLElement, selector: string): HTMLElement {
  const found = root.querySelector(selector);
  if (!(found instanceof HTMLElement))
    throw new Error(`Nothing matches ${selector}.`);
  return found;
}

function boxOf(root: HTMLElement, selector: string): DOMRect {
  return find(root, selector).getBoundingClientRect();
}

function untilAsync(done: () => boolean): Promise<void> {
  if (done())
    return Promise.resolve();
  return new Promise(resolve => {
    const observer: MutationObserver = new MutationObserver(() => {
      if (!done())
        return;
      observer.disconnect();
      resolve();
    });
    observer.observe(document.body, { attributes: true, characterData: true, childList: true, subtree: true });
  });
}

function px(rem: number): number {
  return AppearanceFixture.toPixels(rem);
}

describe("AzureDevOpsWorkItemComponent in the kit's look", () => {
  afterEach(() => {
    AppearanceFixture.reset();
  });

  it.each(AppearanceFixture.modes)("shows the assignee's Azure DevOps picture at the 1.5rem avatar's size before their name, in %s mode", async mode => {
    const fixture = await openAsync(mode, false, true);
    const root: HTMLElement = fixture.nativeElement;
    await untilAsync(() => !Object.isNull(root.querySelector(".person img")));
    const image: DOMRect = boxOf(root, ".person img");

    expect(find(root, ".person img").getAttribute("src")).toBe(picture);
    AppearanceFixture.expectPixels(image.width, px(1.5));
    AppearanceFixture.expectPixels(image.height, px(1.5));
    AppearanceFixture.expectPixels(image.left, boxOf(root, ".person").left);
    await page.screenshot({ element: find(root, ".detail"), path: `${screenshots}/work-item-assignee-picture-${mode}.png` });
  });

  it.each(AppearanceFixture.modes)("gives the list the document's whole width and height, and fills the dock with the chosen work item, in %s mode", async mode => {
    const fixture = await openAsync(mode);
    const root: HTMLElement = fixture.nativeElement;
    const frame = boxOf(root, ".document");
    const dock = boxOf(root, ".dock");
    const list = boxOf(root, ".list");
    const detail = boxOf(root, ".detail");

    expect(find(root, ".document").querySelector(".detail, .history")).toBeNull();
    AppearanceFixture.expectPixels(list.left, frame.left);
    AppearanceFixture.expectPixels(list.width, px(44));
    AppearanceFixture.expectPixels(list.height, px(40));
    AppearanceFixture.expectPixels(detail.left, dock.left);
    AppearanceFixture.expectPixels(detail.width, px(22));
    AppearanceFixture.expectPixels(detail.top, dock.top);
    AppearanceFixture.expectPixels(detail.height, px(40));
    await page.screenshot({ element: find(root, ".window"), path: `${screenshots}/work-items-${mode}.png` });
  });

  it.each(AppearanceFixture.modes)("says the person signed out in a notice at the page's inset, its key and words inside its padding before Sign in, on one centre line, in %s mode",
    async mode => {
      AppearanceFixture.apply(DefaultTheme.theme, mode);
      const context = new FakeWindowPartContext();
      const requests = new RequestAnswers(context);
      requests.answer(AzureDevOpsNames.readWorkItemsMethod, new HostWorkItemList(mine, false).toJson());
      TestBed.configureTestingModule({ providers: [{ provide: WindowPartTokens.context, useValue: context },
        { provide: WindowPartTokens.activeDocument, useValue: signal(false) }] });
      const fixture = TestBed.createComponent(AzureDevOpsWorkItemComponent);
      fixture.componentRef.setInput("instance", "fabrikam/Sample%20Project/7521");
      fixture.autoDetectChanges();
      const root: HTMLElement = fixture.nativeElement;
      root.style.display = "block";
      root.style.width = "44rem";
      await untilAsync(() => !Object.isNull(root.querySelector(".item")));

      context.raiseEvent(AzureDevOpsNames.signInChangedEvent, HostSignIn.signedOut().toJson());
      await untilAsync(() => !Object.isNull(root.querySelector(".signed-out")));
      await fixture.whenStable();
      const probe: HTMLElement = root.appendChild(document.createElement("div"));
      probe.style.cssText = "width: var(--nol-space-3); height: calc(var(--nol-border-width) + var(--nol-view-padding-inline))";
      const margin: number = probe.getBoundingClientRect().width;
      const padding: number = probe.getBoundingClientRect().height;
      probe.remove();
      const frame: DOMRect = root.getBoundingClientRect();
      const notice: DOMRect = boxOf(root, ".signed-out");
      const mark: DOMRect = boxOf(root, ".signed-out .notice-mark");
      const text: DOMRect = boxOf(root, ".signed-out .notice-text");
      const button: DOMRect = boxOf(root, ".signed-out button");
      const middle = (box: DOMRect): number => box.top + box.height / 2;

      AppearanceFixture.expectPixels(notice.left - frame.left, margin);
      AppearanceFixture.expectPixels(notice.top - frame.top, margin);
      AppearanceFixture.expectPixels(frame.right - notice.right, margin);
      AppearanceFixture.expectPixels(mark.left - notice.left, padding);
      AppearanceFixture.expectPixels(notice.right - button.right, padding);
      AppearanceFixture.expectPixels(middle(mark) - middle(button), 0);
      AppearanceFixture.expectPixels(middle(text) - middle(button), 0);
      expect([text.left > mark.right, button.left > text.right, requests.methods]).toEqual([true, true, [AzureDevOpsNames.readWorkItemsMethod]]);
      await page.screenshot({ element: root, path: `${screenshots}/work-items-signed-out-${mode}.png` });
    });

  it.each(AppearanceFixture.modes)("says in the dock, 0.75rem in, that no work item is chosen before a document chooses one, in %s mode", async mode => {
    AppearanceFixture.apply(DefaultTheme.theme, mode);
    TestBed.configureTestingModule({ providers: [{ provide: WindowPartTokens.context, useValue: new FakeWindowPartContext() }] });
    const fixture = TestBed.createComponent(AzureDevOpsWorkItemDetailComponent);
    fixture.componentRef.setInput("instance", "selected");
    fixture.autoDetectChanges();
    await fixture.whenStable();
    const root: HTMLElement = fixture.nativeElement;
    const host = root.getBoundingClientRect();
    const note = boxOf(root, ".empty-view");

    expect(root.textContent?.trim()).toBe("Select a work item to see it here.");
    AppearanceFixture.expectPixels(note.left - host.left, px(0.75));
    AppearanceFixture.expectPixels(note.top - host.top, px(0.75));
  });

  it.each(AppearanceFixture.modes)("sets the new work item and create branch icons before their labels, centred on them, in %s mode", async mode => {
    const fixture = await openAsync(mode);
    const root: HTMLElement = fixture.nativeElement;
    for (const selector of [".new", ".create"]) {
      const icon = boxOf(root, `${selector} .material-symbols-rounded`);
      const label = boxOf(root, `${selector} .nol-button-label`);

      expect(icon.right).toBeLessThanOrEqual(label.left);
      AppearanceFixture.expectPixels(icon.top + icon.height / 2, label.top + label.height / 2);
    }
  });

  it.each(AppearanceFixture.modes)("sets the header's title and button inside its 0.75rem insets, in %s mode", async mode => {
    const fixture = await openAsync(mode);
    const root: HTMLElement = fixture.nativeElement;
    const head = boxOf(root, ".head");
    const title = boxOf(root, ".title");
    const button = boxOf(root, ".new");

    AppearanceFixture.expectPixels(title.left - head.left, px(0.75));
    AppearanceFixture.expectPixels(head.right - button.right, px(0.75));
  });

  it.each(AppearanceFixture.modes)("sets the history 0.75rem in from the view's sides under a line, each commit's subject alone across the row 0.25rem in, cut short, and its hash, author and age on the line below, in %s mode",
    async mode => {
      const fixture = await openAsync(mode, true);
      const root: HTMLElement = fixture.nativeElement;
      const list = boxOf(root, ".detail");
      const section = find(root, ".history");
      const box = section.getBoundingClientRect();
      const rows: readonly HTMLElement[] = [...root.querySelectorAll<HTMLElement>(".history .commit")];
      const first = rows[0];
      if (Object.isUndefined(first))
        throw new Error("The history lists no commits.");
      const row = first.getBoundingClientRect();
      const subject = find(first, ".subject");
      const line = subject.getBoundingClientRect();
      const byline = boxOf(first, ".byline");
      const sha = boxOf(first, ".sha");

      AppearanceFixture.expectPixels(box.left - list.left, px(0.75));
      AppearanceFixture.expectPixels(list.left + find(root, ".detail").clientWidth - box.right, px(0.75));
      expect([getComputedStyle(section).borderTopWidth, rows.length]).toEqual(["1px", 2]);
      AppearanceFixture.expectPixels(line.left - row.left, px(0.25));
      AppearanceFixture.expectPixels(line.width, row.width - px(0.5));
      AppearanceFixture.expectPixels(line.top - row.top, px(0.25));
      AppearanceFixture.expectPixels(byline.top - line.bottom, px(0.125));
      AppearanceFixture.expectPixels(row.bottom - byline.bottom, px(0.25));
      AppearanceFixture.expectPixels(byline.left, line.left);
      AppearanceFixture.expectPixels(sha.left, line.left);
      AppearanceFixture.expectPixels(byline.width, line.width);
      expect(subject.scrollWidth).toBeGreaterThan(subject.clientWidth);
      await page.screenshot({ element: find(root, ".dock"), path: `${screenshots}/work-items-history-${mode}.png` });
    });

  it.each(AppearanceFixture.modes)("draws a subject's work item as a 1.25rem chip centred on the subject's line, its type's 0.875rem icon 0.375rem in, in %s mode", async mode => {
    const fixture = await openAsync(mode, true);
    const root: HTMLElement = fixture.nativeElement;
    const commit = [...root.querySelectorAll<HTMLElement>(".history .commit")][1];
    if (Object.isUndefined(commit))
      throw new Error("The history lists no second commit.");
    const chip = boxOf(commit, ".chip.ref");
    const icon = boxOf(commit, ".chip.ref .chip-icon");
    const subject = boxOf(commit, ".subject");

    AppearanceFixture.expectPixels(chip.height, px(1.25));
    AppearanceFixture.expectPixels(icon.width, px(0.875));
    AppearanceFixture.expectPixels(icon.left - chip.left, px(0.375));
    expect(Math.abs(chip.top + chip.height / 2 - (subject.top + subject.height / 2))).toBeLessThanOrEqual(1);
    expect([chip.right <= subject.right, getComputedStyle(find(commit, ".chip.ref")).boxShadow.includes("inset")]).toEqual([true, true]);
  });

  it.each(AppearanceFixture.modes)("sets the two filter chips 1.25rem high, 0.5rem apart, centred in the header between the title and the button, in %s mode",
    async mode => {
      const fixture = await openAsync(mode);
      const root: HTMLElement = fixture.nativeElement;
      const title = boxOf(root, ".title");
      const button = boxOf(root, ".new");
      const chips: readonly DOMRect[] = [...root.querySelectorAll<HTMLElement>(".chip.filter")].map(t => t.getBoundingClientRect());
      const first = chips[0];
      const last = chips.at(-1);
      if (Object.isUndefined(first) || Object.isUndefined(last))
        throw new Error("The header has no filter chips.");

      expect(chips).toHaveLength(2);
      for (const chip of chips) {
        AppearanceFixture.expectPixels(chip.height, px(1.25));
        AppearanceFixture.expectPixels(chip.top + chip.height / 2, button.top + button.height / 2);
      }
      for (const gap of chips.slice(1).map((chip, i) => chip.left - (chips[i]?.right ?? Number.NaN)))
        AppearanceFixture.expectPixels(gap, px(0.5));
      expect(first.left).toBeGreaterThanOrEqual(title.right);
      expect(last.right).toBeLessThanOrEqual(button.left);
    });

  it.each(AppearanceFixture.modes)("lines every row up in the artboard's columns, 1.75rem high, indenting each level by 1rem, in %s mode", async mode => {
    const fixture = await openAsync(mode);
    const root: HTMLElement = fixture.nativeElement;
    const list = boxOf(root, ".list");
    const rows = [...root.querySelectorAll<HTMLElement>(".wrow")];
    const cells = (row: HTMLElement): readonly DOMRect[] => [...row.children].map(t => t.getBoundingClientRect());
    const header = rows[0];
    const story = rows[3];
    if (Object.isUndefined(header) || Object.isUndefined(story))
      throw new Error("The rows aren't shown.");
    const headerCells = cells(header);
    const storyCells = cells(story);
    const widths = storyCells.map(t => t.width);
    const titles = [...root.querySelectorAll<HTMLElement>(".item .cell-title")];

    expect(rows.map(t => t.getBoundingClientRect().height).every(t => Math.abs(t - px(1.75)) < 0.5)).toBe(true);
    AppearanceFixture.expectPixels(storyCells[0]?.left ?? 0, list.left + px(0.25) + px(0.5));
    expect([widths[0], widths[1], widths[3], widths[4], widths[5]].map(t => Math.round(t ?? 0)))
      .toEqual([px(1.25), px(3.5), px(6.5), px(7), px(6)].map(t => Math.round(t)));
    AppearanceFixture.expectPixels((storyCells[1]?.left ?? 0) - (storyCells[0]?.right ?? 0), px(0.5));
    expect(headerCells.map(t => Math.round(t.left))).toEqual(storyCells.map(t => Math.round(t.left)));
    expect(titles.map(t => Number.parseFloat(getComputedStyle(t).paddingLeft))).toEqual([0, 1, 2, 3, 3].map(t => px(t)));
    const long = titles[3]?.querySelector<HTMLElement>(".title-text");
    expect(!Object.isNullOrUndefined(long) && long.scrollWidth > long.clientWidth).toBe(true);
  });

  it.each(AppearanceFixture.modes)("starts a selected row's pull request chip on the Links column's edge, as a row's plain links, its fill apart from the row's, in %s mode",
    async mode => {
    const fixture = await openAsync(mode);
    const root: HTMLElement = fixture.nativeElement;
    const selected = find(root, ".item.sel");
    const chip = find(selected, ".links .chip");
    const plain = find(root, ".item:not(.sel) .links .muted");
    const column = boxOf(root, ".wrow.caps [role='columnheader']:last-child");
    const luminance = (color: string): number => {
      const [red = 0, green = 0, blue = 0] = (color.match(/[\d.]+/g) ?? []).map(t => Number(t) / 255).map(t => t <= 0.04045 ? t / 12.92 : ((t + 0.055) / 1.055) ** 2.4);
      return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
    };
    const fills = [getComputedStyle(chip).backgroundColor, getComputedStyle(selected).backgroundColor];
    const [lighter = 0, darker = 0] = fills.map(luminance).toSorted((a, b) => b - a);

    expect([chip.textContent, plain.textContent]).toEqual(["!752", "1 child"]);
    AppearanceFixture.expectPixels(chip.getBoundingClientRect().left, column.left);
    AppearanceFixture.expectPixels(plain.getBoundingClientRect().left, column.left);
    expect(fills[0]).not.toMatch(/^rgba\(0, 0, 0, 0\)$/);
    expect((lighter + 0.05) / (darker + 0.05)).toBeGreaterThan(1.2);
  });

  it.each(AppearanceFixture.modes)("sets the detail's fields in a 5.5rem label column inside its border and 0.75rem padding, in %s mode", async mode => {
    const fixture = await openAsync(mode);
    const root: HTMLElement = fixture.nativeElement;
    const detail = boxOf(root, ".detail");
    const label = boxOf(root, ".fields dt");
    const value = boxOf(root, ".fields dd");
    const kind = boxOf(root, ".kind");
    const create = boxOf(root, ".create");
    const border = Number.parseFloat(getComputedStyle(find(root, ".detail")).borderLeftWidth);

    AppearanceFixture.expectPixels(label.left - detail.left, border + px(0.75));
    AppearanceFixture.expectPixels(value.left - label.left, px(5.5) + px(0.5));
    AppearanceFixture.expectPixels(kind.top - detail.top, px(0.75));
    AppearanceFixture.expectPixels(detail.bottom - create.bottom, px(0.75));
    AppearanceFixture.expectPixels(create.left - detail.left, border + px(0.75));
  });

  it.each(AppearanceFixture.modes)("keeps a task's icon and hours whole on one 1.625rem line beside a long title cut short, in %s mode", async mode => {
    const fixture = await openAsync(mode);
    const root: HTMLElement = fixture.nativeElement;
    const line = find(root, ".section .line");
    const [icon, title, hours] = [...line.children].map(t => t.getBoundingClientRect());
    const text = find(line, ".grow");

    AppearanceFixture.expectPixels(line.getBoundingClientRect().height, px(1.625));
    AppearanceFixture.expectPixels(icon?.width ?? 0, px(1));
    expect(text.scrollWidth > text.clientWidth).toBe(true);
    expect((hours?.height ?? Number.POSITIVE_INFINITY) <= (title?.height ?? 0)).toBe(true);
    expect((hours?.right ?? Number.POSITIVE_INFINITY) <= line.getBoundingClientRect().right).toBe(true);
  });

  it.each(AppearanceFixture.modes)("fits the app's narrowest window, 640 by 480 less the title bar and margins, with nothing clipped, outside it or overlapping, in %s mode", async mode => {
    const fixture = await openAsync(mode);
    const frame: HTMLElement = find(fixture.nativeElement, ".document");
    frame.style.width = "39.5rem";
    frame.style.height = "27rem";
    fixture.detectChanges();
    await fixture.whenStable();

    await page.screenshot({ element: frame, path: `${screenshots}/work-items-narrow-${mode}.png` });
    expect(GitLayout.problemsOf(frame)).toEqual([]);
  });

  it.each(AppearanceFixture.modes)("fits a 30rem middle column, with nothing cut, outside it or overlapping, in %s mode", async mode => {
    const fixture = await openAsync(mode);
    const frame: HTMLElement = find(fixture.nativeElement, ".document");
    frame.style.width = "30rem";
    frame.style.height = "40rem";
    fixture.detectChanges();
    await fixture.whenStable();

    await page.screenshot({ element: frame, path: `${screenshots}/work-items-30rem-${mode}.png` });
    expect(GitLayout.problemsOf(frame)).toEqual([]);
  });
});
