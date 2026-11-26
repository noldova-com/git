/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type {} from "@vitest/browser-playwright";
import { Component, input, type InputSignal, signal } from "@angular/core";
import { type ComponentFixture, TestBed } from "@angular/core/testing";
import "@noldova/context.core";
import { WindowPartTokens } from "@noldova/desktop.window";
import { FakeWindowPartContext } from "@noldova/desktop.window/testing";
import { AzureDevOpsNames } from "@noldova/git.azure-devops.protocol";
import { CheckState, FileChangeKind, HostAccount, HostAvatar, HostBuild, HostChanges, HostComment, HostItem, HostPerson, HostPolicy, HostPullRequest,
  HostPullRequestFile, HostPullRequestFiles, HostPullRequestThreads, HostPullRequestUpdate, HostPullRequestUpdates, HostReference, HostReviewer, HostSignIn, HostThread,
  HostWorkItemLink, HostWorkItemType, PolicyState, ReferenceKind, ReferenceState, ThreadStatus, WorkItemCategory } from "@noldova/git.hosting.protocol";
import { DefaultTheme, ThemeMode } from "@noldova/ui.components.angular";
import { provideMarkdown } from "@noldova/ui.components.angular/markdown";
import { AppearanceFixture } from "@noldova/ui.components.angular/testing";
import { afterEach, describe, expect, it } from "vitest";
import { page as browser } from "vitest/browser";

import { GitLayout } from "../../../../../noldova.git.window/tests/fixtures/git-layout.fixture.ts";
import { AzureDevOpsPullRequestComponent } from "../../../../src/app/components/azure-devops-pull-request/azure-devops-pull-request.component.ts";
import { AzureDevOpsPullRequestDetailComponent } from "../../../../src/app/components/azure-devops-pull-request-detail/azure-devops-pull-request-detail.component.ts";
import { RequestAnswers } from "../../../fixtures/request-answers.fixture.ts";

const screenshots: string = "../../../../../../_build/azure-devops-window/screenshots";

@Component({
  selector: "nol-git-azure-devops-document",
  imports: [AzureDevOpsPullRequestComponent, AzureDevOpsPullRequestDetailComponent],
  template: "<div class=\"window\"><div class=\"document\" [style.width.rem]=\"width()\"><nol-git-azure-devops-pull-request instance=\"fabrikam/site/752\" /></div>"
    + "<div class=\"view\"><nol-git-azure-devops-pull-request-detail instance=\"selected\" /></div></div>",
  styles: [
    ".window { display: flex; width: max-content; height: 40rem; color: var(--nol-text); font-family: var(--nol-font-sans); font-size: var(--nol-text-panel);"
    + " line-height: var(--nol-line-panel); }",
    ".document { box-sizing: border-box; flex: none; height: 100%; }",
    ".view { box-sizing: border-box; flex: none; width: var(--nol-dock-right-width); height: 100%; border-inline-start: var(--nol-border-width) solid var(--nol-border); }"
  ]
})
class DocumentComponent {
  public readonly width: InputSignal<number> = input<number>(60);
}

const URL: string = "https://dev.azure.com/fabrikam/web/_git/site/pullrequest/752";
const item: HostItem = new HostItem(new HostReference("git-azure-devops", "fabrikam", "site", 752), ReferenceKind.PullRequest, ReferenceState.Open,
  "Export notes as Markdown from the shared notes list, with a title long enough to run past the header's width so the header cuts it short", URL,
  new HostPerson("monalisa@fabrikam.test", null, null), 1_800_000_000_000, null, 0,
  HostChanges.uncounted("users/monalisa/7521-export-notes", "main", "0123456789abcdef0123456789abcdef01234567"));
const pullRequestWith = (reviewers: readonly HostReviewer[]): HostPullRequest => new HostPullRequest(item, reviewers,
  [new HostPolicy("Minimum number of reviewers", PolicyState.Approved, true, null), new HostPolicy("Comment requirements", PolicyState.Rejected, true, null)],
  [new HostBuild("site-ci", CheckState.Succeeded, "https://dev.azure.com/fabrikam/web/_build/results?buildId=7", 1_800_000_000_000, 1_800_000_372_000)],
  true, "Readers see **due dates** before they pass.", 5,
  [new HostWorkItemLink(7521, "Export notes as Markdown files", new HostWorkItemType("User Story", "009CCC", "icon_book"), "Active",
    WorkItemCategory.InProgress, "https://dev.azure.com/fabrikam/web/_workitems/edit/7521")]);
const pullRequest: HostPullRequest = pullRequestWith([new HostReviewer(new HostPerson("octocat@fabrikam.test", null, null), 1, "Approved", true)]);

const picture: string = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=";

async function openAsync(mode: ThemeMode, width: number = 60, shown: HostPullRequest = pullRequest, pictures: number = 0,
  threads: readonly HostThread[] = []): Promise<ComponentFixture<DocumentComponent>> {
  AppearanceFixture.apply(DefaultTheme.theme, mode);
  const context = new FakeWindowPartContext();
  const requests = new RequestAnswers(context);
  requests.answer(AzureDevOpsNames.readPullRequestMethod, shown.toJson());
  requests.answer(AzureDevOpsNames.readPullRequestThreadsMethod, new HostPullRequestThreads(threads, false).toJson());
  requests.answer(AzureDevOpsNames.readSignInMethod, HostSignIn.signedIn(new HostAccount("monalisa@fabrikam.test", "Mona Lisa", null, [])).toJson());
  requests.answer(AzureDevOpsNames.readMergeTypesMethod, ["squash", "rebase"]);
  requests.otherwise(AzureDevOpsNames.readPullRequestChangesMethod, new HostPullRequestFiles("9fceb02d0ae598e95dc970b74767f19372d61af8", null, Array.from({ length: 12 }, (_, i) =>
    new HostPullRequestFile(`src/notes/f${String(i)}.ts`, FileChangeKind.Modified, null)), false).toJson());
  requests.otherwise(AzureDevOpsNames.readPullRequestUpdatesMethod, new HostPullRequestUpdates(Array.from({ length: 3 }, (_, i) =>
    new HostPullRequestUpdate(i + 1, null, Date.UTC(2026, 10, 20 + i, 12), "0123456789abcdef0123456789abcdef01234567", null)), false).toJson());
  requests.answer(AzureDevOpsNames.readPersonAvatarMethod, ...Array.from({ length: pictures }, () => new HostAvatar(picture).toJson()));
  requests.answer(AzureDevOpsNames.searchPeopleMethod, [{ descriptor: "aad.TW9uYQ", name: "Mona Lisa", login: "monalisa@fabrikam.test", isGroup: false },
    { descriptor: "vssgp.V2Vi", name: "Web Team", login: "[Web Site]\\Web Team", isGroup: true }]);
  TestBed.configureTestingModule({
    providers: [{ provide: WindowPartTokens.context, useValue: context }, { provide: WindowPartTokens.activeDocument, useValue: signal(true) }, provideMarkdown()]
  });
  const fixture = TestBed.createComponent(DocumentComponent);
  fixture.componentRef.setInput("width", width);
  fixture.autoDetectChanges();
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

describe("AzureDevOpsPullRequestComponent in the kit's look", () => {
  afterEach(() => {
    AppearanceFixture.reset();
  });

  it.each(AppearanceFixture.modes)("sets the header inside the page's insets, cutting a long title before the open button, the open icon centred before its label, and each tab's count at its end, in %s mode",
    async mode => {
      const fixture = await openAsync(mode);
      const root: HTMLElement = fixture.nativeElement;
      const page = boxOf(root, ".page");
      const line = boxOf(root, ".title-line");
      const state = boxOf(root, ".state");
      const title = find(root, ".title");
      const open = boxOf(root, ".open");
      const tabs = boxOf(root, ".tabs");

      AppearanceFixture.expectPixels(state.left - page.left, px(0.75));
      AppearanceFixture.expectPixels(page.right - open.right, px(0.75));
      AppearanceFixture.expectPixels(line.top - page.top, px(0.75));
      AppearanceFixture.expectPixels(open.left - title.getBoundingClientRect().right, px(0.5));
      AppearanceFixture.expectPixels(tabs.left - page.left, px(0.75));
      AppearanceFixture.expectPixels(page.right - tabs.right, px(0.75));
      const counted = [...root.querySelectorAll<HTMLElement>(".tab")].filter(t => !Object.isNull(t.querySelector(".badge")));
      expect(counted.map(t => t.textContent)).toEqual(["Files12", "Updates3", "Commits5"]);
      for (const tab of counted) {
        const box = tab.getBoundingClientRect();
        const badge = boxOf(tab, ".badge");
        AppearanceFixture.expectPixels(box.right - badge.right, px(0.5));
        const underline: number = Number.parseFloat(getComputedStyle(tab).borderBottomWidth);
        AppearanceFixture.expectPixels(badge.top + badge.height / 2, box.top + (box.height - underline) / 2);
      }
      expect(title.scrollWidth).toBeGreaterThan(title.clientWidth);
      expect(getComputedStyle(title).textOverflow).toBe("ellipsis");
      const openIcon = boxOf(root, ".open .material-symbols-rounded");
      const openLabel = boxOf(root, ".open .nol-button-label");
      expect(openIcon.right).toBeLessThanOrEqual(openLabel.left);
      AppearanceFixture.expectPixels(openIcon.top + openIcon.height / 2, openLabel.top + openLabel.height / 2);
      await browser.screenshot({ element: find(root, ".document"), path: `${screenshots}/pull-request-${mode}.png` });
    });

  it.each(AppearanceFixture.modes)("marks an active pull request's state with the board's dot icon before its word, a quarter rem from it, both centred in the state's line, in %s mode",
    async mode => {
      const root: HTMLElement = (await openAsync(mode)).nativeElement;
      const state = find(root, ".state");
      const icon = find(state, ".state-icon");
      const word = document.createRange();
      word.selectNodeContents(state.lastChild ?? state);
      const iconBox = icon.getBoundingClientRect();
      const wordBox = word.getBoundingClientRect();

      expect([icon.textContent?.trim(), word.toString().trim()]).toEqual(["radio_button_checked", "Active"]);
      AppearanceFixture.expectPixels(wordBox.left - iconBox.right, px(0.25));
      const line = state.getBoundingClientRect();
      AppearanceFixture.expectPixels(iconBox.top + iconBox.height / 2, line.top + line.height / 2);
      expect(wordBox.top).toBeGreaterThanOrEqual(line.top);
      expect(wordBox.bottom).toBeLessThanOrEqual(line.bottom);
    });

  it.each(AppearanceFixture.modes)("asks before an approval in a line over the footer's vote, inside the page's insets, in %s mode", async mode => {
    const fixture = await openAsync(mode);
    const root: HTMLElement = fixture.nativeElement;
    const approve = (): HTMLElement | undefined => [...document.querySelectorAll<HTMLElement>("button[nol-menu-item]")].find(t => t.innerText.trim() === "Approve");
    find(root, ".vote-menu").click();
    await untilAsync(() => !Object.isUndefined(approve()));
    approve()?.click();
    await untilAsync(() => !Object.isNull(root.querySelector(".vote-confirm")));
    const main = boxOf(root, ".main");
    const vote = boxOf(root, ".vote-line");
    const line = boxOf(root, ".vote-confirm");
    const cancel = boxOf(root, ".vote-confirm .cancel");
    const confirm = boxOf(root, ".vote-confirm .confirm");

    AppearanceFixture.expectPixels(line.left - main.left, px(0.75));
    AppearanceFixture.expectPixels(main.right - confirm.right, px(0.75));
    AppearanceFixture.expectPixels(confirm.left - cancel.right, px(0.5));
    AppearanceFixture.expectPixels(confirm.top, cancel.top);
    AppearanceFixture.expectPixels(vote.top - line.bottom, px(0.5));
  });

  it.each(AppearanceFixture.modes)("ends the main column with a footer at the document's bottom, its note inside the insets and Approve joined to its menu, in %s mode",
    async mode => {
      const fixture = await openAsync(mode, 54);
      const root: HTMLElement = fixture.nativeElement;
      const host = boxOf(root, "nol-git-azure-devops-pull-request");
      const main = boxOf(root, ".main");
      const footer = boxOf(root, ".footer");
      const note = boxOf(root, ".vote-note");
      const approve = boxOf(root, ".approve");
      const menu = boxOf(root, ".vote-split .vote-menu");
      const border = Number.parseFloat(getComputedStyle(find(root, ".footer")).borderTopWidth);

      AppearanceFixture.expectPixels(footer.bottom, host.bottom);
      AppearanceFixture.expectPixels(footer.left, main.left);
      AppearanceFixture.expectPixels(footer.width, main.width);
      AppearanceFixture.expectPixels(note.left - main.left, px(0.75));
      AppearanceFixture.expectPixels(main.right - menu.right, px(0.75));
      AppearanceFixture.expectPixels(menu.left - approve.right, border);
      AppearanceFixture.expectPixels(menu.top, approve.top);
      AppearanceFixture.expectPixels(menu.height, approve.height);
      AppearanceFixture.expectPixels(approve.top - footer.top, px(0.5) + border);
      AppearanceFixture.expectPixels(footer.bottom - approve.bottom, px(0.5));
      expect([note.right <= approve.left, root.querySelector(".footer .cancel-auto-complete, .footer .set-auto-complete")]).toEqual([true, null]);
      await browser.screenshot({ element: find(root, ".window"), path: `${screenshots}/pull-request-complete-${mode}.png` });
    });

  it.each(AppearanceFixture.modes)("ends the Pull request view with the Complete panel as wide as the view, a border over it, its rows and actions inside its insets,"
    + " Cancel auto-complete over Abandon and Complete merge, in %s mode", async mode => {
    const fixture = await openAsync(mode, 54);
    const root: HTMLElement = fixture.nativeElement;
    const view = boxOf(root, "nol-git-azure-devops-pull-request-detail");
    const lists = boxOf(root, ".detail");
    const panel = boxOf(root, ".complete-panel");
    const title = boxOf(root, ".complete-panel .complete-title");
    const choice = boxOf(root, ".complete-panel .choice");
    const message = boxOf(root, ".complete-panel .message");
    const blocking = boxOf(root, ".complete-panel .blocking");
    const action = boxOf(root, ".complete-panel .complete-merge");
    const abandon = boxOf(root, ".complete-panel .abandon");
    const auto = boxOf(root, ".complete-panel .cancel-auto-complete");
    const border = Number.parseFloat(getComputedStyle(find(root, ".complete-panel")).borderTopWidth);

    expect(border).toBeGreaterThan(0);
    AppearanceFixture.expectPixels(panel.left, view.left);
    AppearanceFixture.expectPixels(panel.width, view.width);
    AppearanceFixture.expectPixels(panel.top, lists.bottom);
    AppearanceFixture.expectPixels(title.left - panel.left, px(0.75));
    AppearanceFixture.expectPixels(title.top - panel.top, px(0.75) + border);
    for (const box of [choice, message, blocking]) {
      AppearanceFixture.expectPixels(box.left - panel.left, px(0.75));
      AppearanceFixture.expectPixels(panel.right - box.right, px(0.75));
    }
    AppearanceFixture.expectPixels(panel.right - action.right, px(0.75));
    AppearanceFixture.expectPixels(panel.bottom - action.bottom, px(0.75));
    AppearanceFixture.expectPixels(action.left - abandon.right, px(0.5));
    AppearanceFixture.expectPixels(abandon.top, action.top);
    AppearanceFixture.expectPixels(abandon.height, action.height);
    AppearanceFixture.expectPixels(panel.right - auto.right, px(0.75));
    AppearanceFixture.expectPixels(action.top - auto.bottom, px(0.75));
    AppearanceFixture.expectPixels(auto.height, action.height);
    expect(abandon.left - panel.left).toBeGreaterThanOrEqual(px(0.75) - 1);
    expect(find(root, ".complete-panel .complete-merge").hasAttribute("disabled")).toBe(true);
  });

  it.each(AppearanceFixture.modes)("ends the Reviewers heading with the add button and sets the search and its rows to the column's width, a group's mark after its name, in %s mode", async mode => {
    const fixture = await openAsync(mode);
    const root: HTMLElement = fixture.nativeElement;
    find(root, ".add-reviewer").click();
    await untilAsync(() => !Object.isNull(root.querySelector("nol-git-azure-devops-add-reviewer input")));
    const field = find(root, "nol-git-azure-devops-add-reviewer input");
    if (!(field instanceof HTMLInputElement))
      throw new Error("No search field is shown.");
    field.value = "mon";
    field.dispatchEvent(new Event("input"));
    await untilAsync(() => !Object.isNull(root.querySelector("nol-git-azure-devops-add-reviewer .person")));
    const side = boxOf(root, ".detail .list");
    const head = boxOf(root, ".detail .section-head");
    const title = boxOf(root, ".detail .section-head .section-title");
    const button = boxOf(root, ".add-reviewer");
    const search = boxOf(root, "nol-git-azure-devops-add-reviewer nol-text-field-box");
    const person = boxOf(root, "nol-git-azure-devops-add-reviewer .person");
    const reviewer = boxOf(root, ".detail .reviewer");
    const group = boxOf(root, "nol-git-azure-devops-add-reviewer .person:nth-child(2) .name");
    const kind = boxOf(root, "nol-git-azure-devops-add-reviewer .person:nth-child(2) .kind");

    AppearanceFixture.expectPixels(title.left, side.left);
    AppearanceFixture.expectPixels(button.right, side.right);
    AppearanceFixture.expectPixels(button.top + button.height / 2, title.top + title.height / 2);
    AppearanceFixture.expectPixels(search.left, side.left);
    AppearanceFixture.expectPixels(search.width, side.width);
    AppearanceFixture.expectPixels(search.top - head.bottom, px(0.5));
    AppearanceFixture.expectPixels(person.left, side.left);
    AppearanceFixture.expectPixels(person.width, side.width);
    AppearanceFixture.expectPixels(person.top - search.bottom, px(0.5));
    AppearanceFixture.expectPixels(reviewer.left, side.left);
    AppearanceFixture.expectPixels(kind.left - group.right, px(0.5));
    AppearanceFixture.expectPixels(kind.top + kind.height / 2, group.top + group.height / 2);
    expect(kind.right).toBeLessThanOrEqual(side.right);
  });

  it.each(AppearanceFixture.modes)("lays the overview in one column inside the page's insets, and the view's sections inside its own, the policies card's in its"
    + " border, in %s mode", async mode => {
    const fixture = await openAsync(mode);
    const root: HTMLElement = fixture.nativeElement;
    const body = boxOf(root, ".body");
    const main = boxOf(root, ".column");
    const view = boxOf(root, "nol-git-azure-devops-pull-request-detail");
    const sections: DOMRect[] = [...root.querySelectorAll(".detail > section")].map(t => t.getBoundingClientRect());
    const card = find(root, ".card");
    const border = Number.parseFloat(getComputedStyle(card).borderLeftWidth);
    const cardBox = card.getBoundingClientRect();
    const policy = boxOf(root, ".policy");

    AppearanceFixture.expectPixels(main.left - body.left, px(0.75));
    AppearanceFixture.expectPixels(body.right - main.right, px(0.75));
    expect(sections).toHaveLength(4);
    AppearanceFixture.expectPixels(sections[0]?.top ?? 0, view.top + px(0.75));
    for (const [index, section] of sections.entries()) {
      AppearanceFixture.expectPixels(section.left - view.left, px(0.75));
      AppearanceFixture.expectPixels(view.right - section.right, px(0.75));
      if (index > 0)
        AppearanceFixture.expectPixels(section.top - (sections[index - 1]?.bottom ?? 0), px(0.75));
    }
    AppearanceFixture.expectPixels(policy.left - cardBox.left, px(0.75) + border);
    AppearanceFixture.expectPixels(cardBox.right - policy.right, px(0.75) + border);
    await browser.screenshot({ element: find(root, ".view"), path: `${screenshots}/pull-request-view-${mode}.png` });
  });

  it.each(AppearanceFixture.modes)("says to open a pull request inside the view's insets once no pull request is shown, in %s mode", async mode => {
    AppearanceFixture.apply(DefaultTheme.theme, mode);
    TestBed.configureTestingModule({ providers: [{ provide: WindowPartTokens.context, useValue: new FakeWindowPartContext() }] });
    const fixture = TestBed.createComponent(AzureDevOpsPullRequestDetailComponent);
    fixture.componentRef.setInput("instance", "selected");
    fixture.autoDetectChanges();
    await fixture.whenStable();
    const view: HTMLElement = fixture.nativeElement;
    view.style.width = "var(--nol-dock-right-width)";
    view.style.height = "10rem";
    const text = find(view, ".empty-view");
    const box = text.getBoundingClientRect();
    const frame = view.getBoundingClientRect();
    const probe: HTMLElement = document.createElement("span");
    probe.style.color = "var(--nol-text-muted)";
    view.append(probe);

    expect([text.textContent.trim(), getComputedStyle(text).color]).toEqual(["Open a pull request to see its details here.", getComputedStyle(probe).color]);
    probe.remove();
    AppearanceFixture.expectPixels(box.left - frame.left, px(0.75));
    AppearanceFixture.expectPixels(box.top - frame.top, px(0.75));
    AppearanceFixture.expectPixels(frame.right - box.right, px(0.75));
    await browser.screenshot({ element: view, path: `${screenshots}/pull-request-view-empty-${mode}.png` });
  });

  it.each(AppearanceFixture.modes)("sets a build number in the muted monospace beside its policy's or build's name, on its line, and running after the requirement at the card's"
    + " inset, in %s mode", async mode => {
    const fixture = await openAsync(mode, 40, new HostPullRequest(item, [], [
      new HostPolicy("Build: garden-web PR validation", PolicyState.Approved, true, null, "20261121.4"),
      new HostPolicy("Build: dependency scan", PolicyState.Running, false, null)
    ], [new HostBuild("PR validation", CheckState.Succeeded, "https://dev.azure.com/fabrikam/web/_build/results?buildId=7", 1_800_000_000_000, 1_800_000_372_000,
      "20261121.4")], false, "", 1, []));
    const root: HTMLElement = fixture.nativeElement;
    find(root, ".view").style.width = "32rem";
    const card = find(root, ".card");
    const border = Number.parseFloat(getComputedStyle(card).borderRightWidth);
    const [numbered, running] = [...root.querySelectorAll<HTMLElement>(".policy")];
    const policyNumber = numbered?.querySelector<HTMLElement>(".build-number") ?? card;
    const name = policyNumber.parentElement ?? card;
    const requirement = running?.lastElementChild ?? card;
    const row = find(root, "div.row");
    const buildNumber = row.querySelector<HTMLElement>(".build-number") ?? row;
    const open = row.querySelector("button") ?? row;
    const probe = document.createElement("span");
    probe.style.fontFamily = "var(--nol-font-mono)";
    probe.style.color = "var(--nol-text-muted)";
    root.append(probe);
    const centre = (box: DOMRect): number => box.top + box.height / 2;

    expect([requirement.textContent?.trim(), getComputedStyle(policyNumber).fontFamily, getComputedStyle(policyNumber).color, getComputedStyle(buildNumber).fontFamily,
      getComputedStyle(buildNumber).color, buildNumber.textContent]).toEqual(["Optional · running", getComputedStyle(probe).fontFamily, getComputedStyle(probe).color,
      getComputedStyle(probe).fontFamily, getComputedStyle(probe).color, "#20261121.4"]);
    expect(Math.abs(centre(policyNumber.getBoundingClientRect()) - centre(name.getBoundingClientRect()))).toBeLessThanOrEqual(1);
    expect(policyNumber.getBoundingClientRect().left).toBeGreaterThan(name.getBoundingClientRect().left);
    AppearanceFixture.expectPixels(card.getBoundingClientRect().right - border - requirement.getBoundingClientRect().right, px(0.75));
    AppearanceFixture.expectPixels(open.getBoundingClientRect().left - buildNumber.getBoundingClientRect().right, Number.parseFloat(getComputedStyle(row).columnGap));
    AppearanceFixture.expectPixels(centre(buildNumber.getBoundingClientRect()), centre(row.getBoundingClientRect()));
    probe.remove();
    await browser.screenshot({ element: find(root, ".window"), path: `${screenshots}/pull-request-build-numbers-${mode}.png` });
  });

  it.each(AppearanceFixture.modes)("names a group reviewer without its project, on one line cut with an ellipsis inside the view, the whole name its tooltip, in %s mode",
    async mode => {
      const group: string = "[Sample]\\owls_and_otters_triage_rota_for_the_quarterly_platform_upgrade_window";
      const fixture = await openAsync(mode, 60, pullRequestWith([new HostReviewer(new HostPerson(group, null, null), 0, "No vote", true)]));
      const root: HTMLElement = fixture.nativeElement;
      const name = find(root, ".reviewer .name");
      const style = getComputedStyle(name);

      expect([name.textContent, name.title, style.textOverflow, name.scrollWidth > name.clientWidth])
        .toEqual(["owls_and_otters_triage_rota_for_the_quarterly_platform_upgrade_window", group, "ellipsis", true]);
      AppearanceFixture.expectPixels(name.getBoundingClientRect().height, parseFloat(style.lineHeight));
      expect(name.getBoundingClientRect().right).toBeLessThanOrEqual(boxOf(root, ".detail .list").right);
    });

  it.each(AppearanceFixture.modes)("marks a reviewer's vote at the avatar's corner, ringed in the window color the dock draws the view on, in %s mode", async mode => {
    const fixture = await openAsync(mode);
    const root: HTMLElement = fixture.nativeElement;
    const avatar = boxOf(root, ".reviewer nol-avatar");
    const vote = find(root, ".vote");
    const voteBox = vote.getBoundingClientRect();
    const style = getComputedStyle(vote);

    AppearanceFixture.expectPixels(voteBox.right - avatar.right, px(0.25));
    AppearanceFixture.expectPixels(voteBox.bottom - avatar.bottom, px(0.25));
    AppearanceFixture.expectPixels(voteBox.width, px(0.875));
    const backdrop = document.createElement("span");
    backdrop.style.backgroundColor = "var(--nol-window)";
    root.append(backdrop);
    expect([style.borderTopColor, getComputedStyle(find(root, "nol-git-azure-devops-pull-request-detail")).backgroundColor])
      .toEqual([getComputedStyle(backdrop).backgroundColor, "rgba(0, 0, 0, 0)"]);
    backdrop.remove();
  });

  it.each(AppearanceFixture.modes)("draws reviewers as the board does: 1.5rem avatars, a group's as a groups icon, each vote's badge in its state's color with a white mark, none without a vote, and Required at the row's end, in %s mode",
    async mode => {
      const fixture = await openAsync(mode, 60, pullRequestWith([
        new HostReviewer(new HostPerson("octocat@fabrikam.test", null, null), 0.5, "Approved with suggestions", true),
        new HostReviewer(new HostPerson("hubot@fabrikam.test", null, null), -0.5, "Waiting for the author", false),
        new HostReviewer(new HostPerson("monalisa@fabrikam.test", null, null), -1, "Rejected", false),
        new HostReviewer(new HostPerson("[Web Site]\\Web Team", null, null), 0, "No vote", false)]));
      const root: HTMLElement = fixture.nativeElement;
      const rows: HTMLElement[] = [...root.querySelectorAll<HTMLElement>(".reviewer")];
      const colorOf = (token: string): string => {
        const probe: HTMLElement = document.createElement("span");
        probe.style.backgroundColor = `var(${token})`;
        root.append(probe);
        const color: string = getComputedStyle(probe).backgroundColor;
        probe.remove();
        return color;
      };
      const badges: HTMLElement[] = rows.slice(0, 3).map(t => find(t, ".vote"));
      const group: HTMLElement = find(rows[3] ?? root, ".group-avatar");
      const required: HTMLElement = find(rows[0] ?? root, ".required");

      expect(badges.map(t => getComputedStyle(t).backgroundColor))
        .toEqual([colorOf("--nol-status-ok"), colorOf("--nol-warning"), colorOf("--nol-status-failed")]);
      expect(badges.map(t => getComputedStyle(find(t, ".material-symbols-rounded")).color)).toEqual(Array(3).fill("rgb(255, 255, 255)"));
      expect([rows[3]?.querySelector(".vote") ?? null, group.textContent.trim(), getComputedStyle(group).backgroundColor, rows.map(t => !Object.isNull(t.querySelector(".required")))])
        .toEqual([null, "groups", colorOf("--nol-avatar-violet"), [true, false, false, false]]);
      for (const avatar of [...rows.slice(0, 3).map(t => find(t, "nol-avatar")), group]) {
        AppearanceFixture.expectPixels(avatar.getBoundingClientRect().width, px(1.5));
        AppearanceFixture.expectPixels(avatar.getBoundingClientRect().height, px(1.5));
      }
      AppearanceFixture.expectPixels(required.getBoundingClientRect().right, rows[0]?.getBoundingClientRect().right ?? 0);
    });

  it.each(AppearanceFixture.modes)("shows the author's and each reviewer's Azure DevOps picture at the 1.5rem avatar's size, a group keeping its icon, in %s mode", async mode => {
    const fixture = await openAsync(mode, 60, pullRequestWith([new HostReviewer(new HostPerson("octocat@fabrikam.test", null, null), 1, "Approved", true),
      new HostReviewer(new HostPerson("[Web Site]\\Web Team", null, null), 0, "No vote", false)]), 3);
    const root: HTMLElement = fixture.nativeElement;
    await untilAsync(() => root.querySelectorAll(".meta img, .reviewer img").length === 2);
    const images: HTMLImageElement[] = [...root.querySelectorAll<HTMLImageElement>(".meta img, .reviewer img")];

    expect([images.map(t => t.getAttribute("src")), root.querySelectorAll(".reviewer .group-avatar").length]).toEqual([[picture, picture], 1]);
    for (const image of images) {
      AppearanceFixture.expectPixels(image.getBoundingClientRect().width, px(1.5));
      AppearanceFixture.expectPixels(image.getBoundingClientRect().height, px(1.5));
    }
    await browser.screenshot({ element: find(root, ".window"), path: `${screenshots}/pull-request-pictures-${mode}.png` });
  });

  it.each(AppearanceFixture.modes)("puts a 0.5rem dot before each work item's state, a quarter rem from its text and centred on its line, in %s mode", async mode => {
    const fixture = await openAsync(mode);
    const root: HTMLElement = fixture.nativeElement;
    await untilAsync(() => !Object.isNull(root.querySelector(".description strong")));
    const state = find(root, ".work-state");
    const dot = boxOf(root, ".work-state .dot");
    const text = state.lastChild;
    if (!(text instanceof Text))
      throw new Error("The state has no text after its dot.");
    const range = document.createRange();
    range.selectNodeContents(text);
    const words = range.getBoundingClientRect();
    const box = state.getBoundingClientRect();

    AppearanceFixture.expectPixels(dot.width, px(0.5));
    AppearanceFixture.expectPixels(dot.height, px(0.5));
    AppearanceFixture.expectPixels(dot.left, box.left);
    AppearanceFixture.expectPixels(words.left - dot.right, px(0.25));
    AppearanceFixture.expectPixels(dot.top + dot.height / 2, box.top + box.height / 2);
    await browser.screenshot({ element: find(root, ".window"), path: `${screenshots}/pull-request-work-items-${mode}.png` });
  });

  it.each(AppearanceFixture.modes)("fits the app's narrowest window, 640 by 480 less the title bar and margins, and the view beside it, with nothing clipped, outside them or overlapping, in"
    + " %s mode", async mode => {
    const fixture = await openAsync(mode, 39.5);
    const frame: HTMLElement = find(fixture.nativeElement, ".document");
    frame.style.width = "39.5rem";
    frame.style.height = "27rem";
    fixture.detectChanges();
    await fixture.whenStable();

    await browser.screenshot({ element: frame, path: `${screenshots}/pull-request-narrow-${mode}.png` });
    expect([GitLayout.problemsOf(frame), GitLayout.problemsOf(find(fixture.nativeElement, ".view"))]).toEqual([[], []]);
  });

  it.each(AppearanceFixture.modes)("fits a 30rem middle column, with nothing cut, outside it or overlapping, in %s mode", async mode => {
    const fixture = await openAsync(mode, 30);
    const frame: HTMLElement = find(fixture.nativeElement, ".document");
    frame.style.width = "30rem";
    frame.style.height = "40rem";
    fixture.detectChanges();
    await fixture.whenStable();

    await browser.screenshot({ element: frame, path: `${screenshots}/pull-request-30rem-${mode}.png` });
    expect(GitLayout.problemsOf(frame)).toEqual([]);
  });

  it.each(AppearanceFixture.modes)("fits a 30rem middle column with the comment threads on the overview, with nothing cut, outside it or overlapping, in %s mode", async mode => {
    const octocat: HostPerson = new HostPerson("octocat@fabrikam.test", null, null);
    const fixture = await openAsync(mode, 30, pullRequest, 0, [
      new HostThread(3, ThreadStatus.Active, null, null, [
        new HostComment(1, null, octocat, 1_800_000_000_000, "Could the export say which folder the note is kept in, so a user with two folders knows where to look?"),
        new HostComment(2, 1, new HostPerson("monalisa@fabrikam.test", null, null), 1_800_000_060_000, "Yes, it reads the folder's name from the note itself.")]),
      new HostThread(5, ThreadStatus.Active, "/src/notes/shared-notes-list/markdown-note-export-schedule.component.ts", 41,
        [new HostComment(1, null, octocat, 1_800_000_120_000, "Is this the right default for an export made a day before?")]),
      new HostThread(7, ThreadStatus.Resolved, null, null, [new HostComment(1, null, octocat, 1_800_000_180_000, "Done.")])]);
    const frame: HTMLElement = find(fixture.nativeElement, ".document");
    frame.style.width = "30rem";
    frame.style.height = "60rem";
    fixture.detectChanges();
    await fixture.whenStable();
    await untilAsync(() => frame.querySelectorAll(".comment").length > 0);
    await fixture.whenStable();

    await browser.screenshot({ element: frame, path: `${screenshots}/pull-request-threads-30rem-${mode}.png` });
    expect([frame.querySelectorAll(".comment").length > 0, GitLayout.problemsOf(frame)]).toEqual([true, []]);
  });
});
