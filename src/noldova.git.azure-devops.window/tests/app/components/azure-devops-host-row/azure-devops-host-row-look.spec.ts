/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type {} from "@vitest/browser-playwright";
import { Component } from "@angular/core";
import { type ComponentFixture, TestBed } from "@angular/core/testing";
import { WindowPartTokens } from "@noldova/desktop.window";
import { FakeWindowPartContext } from "@noldova/desktop.window/testing";
import { AzureDevOpsNames } from "@noldova/git.azure-devops.protocol";
import { BranchPullRequest, CheckState, HostAccount, HostChanges, HostCheck, HostItem, HostReference, HostSignIn, ReferenceKind,
  ReferenceState } from "@noldova/git.hosting.protocol";
import { GitRemote, RemoteTransport } from "@noldova/git.protocol";
import { DefaultTheme, ThemeMode } from "@noldova/ui.components.angular";
import { AppearanceFixture, PointerFixture, TooltipFixture } from "@noldova/ui.components.angular/testing";
import { afterEach, describe, expect, it } from "vitest";
import { cdp, page } from "vitest/browser";

import { AzureDevOpsHostRowComponent } from "../../../../src/app/components/azure-devops-host-row/azure-devops-host-row.component.ts";
import { RequestAnswers } from "../../../fixtures/request-answers.fixture.ts";
import { WindowFailure } from "../../../fixtures/window-failure.fixture.ts";

@Component({
  selector: "nol-git-azure-devops-dock",
  imports: [AzureDevOpsHostRowComponent],
  template: "<div class=\"dock\"><nol-git-azure-devops-host-row folder=\"/work/site\" branch=\"feature/readme\" [head]=\"null\" [remote]=\"remote\" /></div>",
  styles: [
    ".dock { box-sizing: border-box; width: 25rem; padding: 0.75rem; background: var(--nol-panel); color: var(--nol-text);"
    + " font-family: var(--nol-font-sans); font-size: var(--nol-text-panel); line-height: var(--nol-line-panel); }"
  ]
})
class DockComponent {
  protected readonly remote: GitRemote = new GitRemote("origin", "dev.azure.com", "fabrikam/web/_git/site", RemoteTransport.Https);
}

const account: HostAccount = new HostAccount("monalisa@example.com", "Mona Lisa", null, []);
const title: string = "Sample completed pull request with a long title that runs on past the width of the row, so the row cuts it";
const builds: string = "https://dev.azure.com/fabrikam/web/_build/results?buildId=";
const longCheck: string = "Sample build with a long name (Linux x64) that runs on past the width of the row, so the row cuts it short at its end, with a few more words added";
const completed: HostItem = new HostItem(new HostReference("git-azure-devops", "fabrikam", "3f2504e0-4f89-11d3-9a0c-0305e82c3301", 1234), ReferenceKind.PullRequest,
  ReferenceState.Merged, title, "https://dev.azure.com/fabrikam/web/_git/site/pullrequest/1234", null, 1_800_000_000_000, 1_800_000_360_000, 0,
  new HostChanges(null, null, null, "feature/readme", "main", "0123456789abcdef0123456789abcdef01234567"));
const answer: BranchPullRequest = new BranchPullRequest(completed, [
  new HostCheck("Linux x64", CheckState.Succeeded, `${builds}1`),
  new HostCheck("macOS arm64", CheckState.Running, `${builds}2`),
  new HostCheck(longCheck, CheckState.Succeeded, `${builds}3`),
  new HostCheck("Minimum number of reviewers", CheckState.Failed, null)
]);
const screenshots: string = "../../../../../../_build/azure-devops-window/screenshots";

async function openAsync(mode: ThemeMode, signIn: HostSignIn, pullRequest: BranchPullRequest | null,
  prepare: (context: FakeWindowPartContext, requests: RequestAnswers) => void = () => undefined): Promise<ComponentFixture<DockComponent>> {
  AppearanceFixture.apply(DefaultTheme.theme, mode);
  const context = new FakeWindowPartContext();
  const requests = new RequestAnswers(context);
  requests.answer(AzureDevOpsNames.readSignInMethod, signIn.toJson());
  if (pullRequest !== null)
    requests.answer(AzureDevOpsNames.readBranchPullRequestMethod, pullRequest.toJson());
  prepare(context, requests);
  TestBed.configureTestingModule({ providers: [{ provide: WindowPartTokens.context, useValue: context }, TooltipFixture.atOnce] });
  const fixture = TestBed.createComponent(DockComponent);
  fixture.autoDetectChanges();
  await settleAsync(fixture);
  return fixture;
}

async function settleAsync(fixture: ComponentFixture<DockComponent>): Promise<void> {
  await fixture.whenStable();
  fixture.detectChanges();
  await fixture.whenStable();
}

function find(root: HTMLElement, selector: string): HTMLElement {
  const found = root.querySelector(selector);
  if (!(found instanceof HTMLElement))
    throw new Error(`Nothing matches ${selector}.`);
  return found;
}

async function failLinkAsync(mode: ThemeMode): Promise<ComponentFixture<DockComponent>> {
  const fixture = await openAsync(mode, HostSignIn.signedIn(account), answer, context => {
    context.answer("openLinkAsync", async () => {
      throw new WindowFailure("No browser.");
    });
  });
  find(fixture.nativeElement, ".title").click();
  await settleAsync(fixture);
  return fixture;
}

function expectFailureNotice(notice: HTMLElement): void {
  const card = notice.getBoundingClientRect();
  const border = Number.parseFloat(getComputedStyle(notice).borderLeftWidth);
  const icon = find(notice, ".notice-icon").getBoundingClientRect();
  const text = find(notice, ".notice-text").getBoundingClientRect();
  const button = find(notice, "button").getBoundingClientRect();
  const style = getComputedStyle(notice);

  AppearanceFixture.expectPixels(icon.left - card.left, px(0.625) + border);
  AppearanceFixture.expectPixels(icon.width, px(1));
  AppearanceFixture.expectPixels(text.left - icon.right, px(0.5));
  AppearanceFixture.expectPixels(button.left - text.right, px(0.5));
  AppearanceFixture.expectPixels(card.right - button.right, px(0.625) + border);
  AppearanceFixture.expectPixels(icon.top + icon.height / 2, text.top + text.height / 2);
  AppearanceFixture.expectRem(style.paddingTop, 0.5);
  AppearanceFixture.expectRem(style.paddingLeft, 0.625);
}

function all(root: HTMLElement, selector: string): HTMLElement[] {
  return [...root.querySelectorAll(selector)].filter(t => t instanceof HTMLElement);
}

function resolve(color: string): string {
  const probe = document.createElement("span");
  probe.style.color = color;
  document.body.append(probe);
  const resolved = getComputedStyle(probe).color;
  probe.remove();
  return resolved;
}

function px(rem: number): number {
  return AppearanceFixture.toPixels(rem);
}

function emulateForcedColorsAsync(value: string): Promise<unknown> {
  return cdp().send("Emulation.setEmulatedMedia", { features: [{ name: "forced-colors", value }] });
}

describe("AzureDevOpsHostRowComponent in the kit's look", () => {
  afterEach(async () => {
    try {
      await emulateForcedColorsAsync("none");
    }
    finally {
      try {
        (await AppearanceFixture.parkPointerAsync()).remove();
      }
      finally {
        AppearanceFixture.reset();
      }
    }
  });

  it.each(AppearanceFixture.modes)("shows the whole title and check name in a tooltip while the row cuts them, and none for a check name it shows whole, in %s mode", async mode => {
    const fixture = await openAsync(mode, HostSignIn.signedIn(account), answer);
    const root: HTMLElement = fixture.nativeElement;
    const shown: (string | null)[] = [];

    for (const target of [find(root, "button.name"), find(root, ".title"), all(root, ".name").at(-1) ?? find(root, ".name")]) {
      await PointerFixture.hoverAsync(target);
      await fixture.whenStable();
      shown.push(document.querySelector("nol-tooltip")?.textContent?.trim() ?? null);
    }

    expect(shown).toEqual([null, `!1234 ${title}`, longCheck]);
  });

  it.each(AppearanceFixture.modes)("sets the pull request's line and its checks inside the card's insets, worst first, in %s mode", async mode => {
    const fixture = await openAsync(mode, HostSignIn.signedIn(account), answer);
    const root: HTMLElement = fixture.nativeElement;
    const card = find(root, ".pr").getBoundingClientRect();
    const border = Number.parseFloat(getComputedStyle(find(root, ".pr")).borderLeftWidth);
    const state = find(root, ".state").getBoundingClientRect();
    const titleBox = find(root, ".title").getBoundingClientRect();
    const open = find(root, ".open").getBoundingClientRect();
    const line = find(root, ".line").getBoundingClientRect();
    const checks = all(root, ".check");
    const icons = all(root, ".check-icon").map(t => t.getBoundingClientRect());
    const names = all(root, ".name").map(t => t.getBoundingClientRect());
    const labels = all(root, ".check-state").map(t => t.getBoundingClientRect());

    AppearanceFixture.expectPixels(state.left - card.left, px(0.625) + border);
    AppearanceFixture.expectPixels(state.width, px(1));
    AppearanceFixture.expectPixels(state.height, px(1));
    AppearanceFixture.expectPixels(titleBox.left - state.right, px(0.5));
    AppearanceFixture.expectPixels(open.left - titleBox.right, px(0.5));
    AppearanceFixture.expectPixels(card.right - open.right, px(0.625) + border);
    AppearanceFixture.expectPixels(line.top - card.top, px(0.5) + border);
    AppearanceFixture.expectTruncates(find(root, ".title .text"));
    AppearanceFixture.expectTruncates(all(root, ".name .text").at(-1) ?? find(root, ".name .text"));
    expect(checks.map(t => t.getBoundingClientRect().height >= px(1.375) - 1 / 32)).toEqual([true, true, true, true]);
    AppearanceFixture.expectPixels((checks[0]?.getBoundingClientRect().top ?? 0) - line.bottom, px(0.25 + 0.125));
    AppearanceFixture.expectPixels(card.bottom - (checks.at(-1)?.getBoundingClientRect().bottom ?? 0), px(0.5) + border);
    for (const icon of icons) {
      AppearanceFixture.expectPixels(icon.left, state.left);
      AppearanceFixture.expectPixels(icon.width, px(1));
    }
    for (const name of names)
      AppearanceFixture.expectPixels(name.left, titleBox.left);
    for (const label of labels)
      AppearanceFixture.expectPixels(label.right, card.right - px(0.625) - border);
    expect(getComputedStyle(find(root, ".state")).color).toBe(resolve("var(--nol-accent)"));
    expect(getComputedStyle(find(root, ".title")).color).toBe(resolve("var(--nol-link)"));
    expect(all(root, ".check-state").map(t => getComputedStyle(t).color)).toEqual([resolve("var(--nol-status-failed)"), resolve("var(--nol-text-muted)"),
      resolve("var(--nol-status-ok)"), resolve("var(--nol-status-ok)")]);
    expect(all(root, ".check-icon").map(t => getComputedStyle(t).color)).toEqual([resolve("var(--nol-status-failed)"),
      resolve("var(--nol-text-muted)"), resolve("var(--nol-status-ok)"), resolve("var(--nol-status-ok)")]);

    await page.screenshot({ element: find(root, ".dock"), path: `${screenshots}/host-row-pull-request-${mode}.png` });
  });

  it.each(AppearanceFixture.modes)("draws each pull request state's icon in the kit's colour for that state, in %s mode", async mode => {
    const states: readonly (readonly [ReferenceState, string, number | null])[] = [[ReferenceState.Open, "var(--nol-status-ok)", null],
      [ReferenceState.Draft, "var(--nol-text-muted)", null], [ReferenceState.Closed, "var(--nol-text-muted)", 1_800_000_360_000],
      [ReferenceState.Merged, "var(--nol-accent)", 1_800_000_360_000]];
    const shown: string[] = [];
    const expected: string[] = [];
    for (const [state, colour, closedAt] of states) {
      const item = new HostItem(completed.reference, ReferenceKind.PullRequest, state, "Sample pull request", completed.url, null, completed.createdAt, closedAt, 0,
        completed.changes);
      const fixture = await openAsync(mode, HostSignIn.signedIn(account), new BranchPullRequest(item, []));
      shown.push(getComputedStyle(find(fixture.nativeElement, ".state")).color);
      expected.push(resolve(colour));
      await page.screenshot({ element: find(fixture.nativeElement, ".dock"), path: `${screenshots}/host-row-state-${state}-${mode}.png` });
      fixture.destroy();
      TestBed.resetTestingModule();
    }

    expect(shown).toEqual(expected);
  });

  it.each(AppearanceFixture.modes)("sets the signed-out and no pull request lines' mark and wrapping text on the card's insets, in %s mode", async mode => {
    for (const [name, signIn, pullRequest] of [["signed-out", HostSignIn.signedOut(), null],
      ["no-pull-request", HostSignIn.signedIn(account), new BranchPullRequest(null, [])]] as const) {
      const fixture = await openAsync(mode, signIn, pullRequest);
      const root: HTMLElement = fixture.nativeElement;
      const notice = find(root, ".notice");
      const card = notice.getBoundingClientRect();
      const border = Number.parseFloat(getComputedStyle(notice).borderLeftWidth);
      const mark = find(root, ".notice-mark").getBoundingClientRect();
      const text = find(root, ".notice-text").getBoundingClientRect();
      const style = getComputedStyle(notice);

      AppearanceFixture.expectPixels(mark.left - card.left, px(0.625) + border);
      AppearanceFixture.expectPixels(mark.width, px(1));
      AppearanceFixture.expectPixels(text.left - mark.right, px(0.5));
      AppearanceFixture.expectPixels(card.right - text.right, px(0.625) + border);
      AppearanceFixture.expectPixels(text.top - card.top, px(0.5) + border);
      AppearanceFixture.expectPixels(card.bottom - text.bottom, px(0.5) + border);
      AppearanceFixture.expectPixels(find(root, ".dock").getBoundingClientRect().width - card.width, px(0.75 * 2));
      expect([style.borderTopStyle, style.backgroundColor, getComputedStyle(find(root, ".notice-mark")).color, all(root, "button:not(.board)").length])
        .toEqual(["solid", resolve("var(--nol-raised)"), style.color, 0]);

      await page.screenshot({ element: find(root, ".dock"), path: `${screenshots}/host-row-${name}-${mode}.png` });
      fixture.destroy();
      TestBed.resetTestingModule();
    }
  });

  it.each(AppearanceFixture.modes)("sets the unanswered notice's error mark, its wrapping text and Try again on the card's insets, in %s mode", async mode => {
    const fixture = await openAsync(mode, HostSignIn.signedIn(account), null,
      (_, requests) => requests.fail(AzureDevOpsNames.readBranchPullRequestMethod, new WindowFailure("Azure DevOps didn't answer.")));
    const root: HTMLElement = fixture.nativeElement;
    const notice = find(root, "[role=alert]");

    expect(all(root, ".notice")).toHaveLength(1);
    expectFailureNotice(notice);
    expect([getComputedStyle(notice).borderTopStyle, getComputedStyle(notice).backgroundColor, getComputedStyle(find(notice, ".notice-icon")).color])
      .toEqual(["solid", resolve("var(--nol-raised)"), resolve("var(--nol-status-failed)")]);
    AppearanceFixture.expectPixels(find(root, ".dock").getBoundingClientRect().width - notice.getBoundingClientRect().width, px(0.75 * 2));

    await page.screenshot({ element: find(root, ".dock"), path: `${screenshots}/host-row-unanswered-${mode}.png` });
  });

  it.each(AppearanceFixture.modes)("keeps the pull request's card and sets the page-not-opened notice under it, a gap apart, on the same insets, in %s mode", async mode => {
    const fixture = await failLinkAsync(mode);
    const root: HTMLElement = fixture.nativeElement;
    const cardBox = find(root, ".pr").getBoundingClientRect();
    const failed = find(root, "[role=alert]");
    const failedBox = failed.getBoundingClientRect();

    expect(all(root, ".notice")).toHaveLength(1);
    expectFailureNotice(failed);
    AppearanceFixture.expectPixels(failedBox.top - cardBox.bottom, px(0.5));
    AppearanceFixture.expectPixels(failedBox.left, cardBox.left);
    AppearanceFixture.expectPixels(failedBox.right, cardBox.right);
    expect(getComputedStyle(find(failed, ".notice-icon")).color).toBe(resolve("var(--nol-status-failed)"));

    await page.screenshot({ element: find(root, ".dock"), path: `${screenshots}/host-row-link-failed-${mode}.png` });
  });

  it.each(AppearanceFixture.modes)("sets the My work items link under the card, its text on the card's inset, in label type and the link colour, in %s mode",
    async mode => {
    for (const [name, signIn, pullRequest, mark] of [["pull-request", HostSignIn.signedIn(account), answer, ".state"],
      ["signed-out", HostSignIn.signedOut(), null, ".notice-mark"]] as const) {
      const fixture = await openAsync(mode, signIn, pullRequest);
      const root: HTMLElement = fixture.nativeElement;
      const card = find(root, name === "signed-out" ? ".notice" : ".pr").getBoundingClientRect();
      const links = all(root, ".board");
      const boxes = links.map(t => t.getBoundingClientRect());
      const style = getComputedStyle(links[0] ?? root);

      expect(links.map(t => t.textContent?.trim())).toEqual(["My work items"]);
      AppearanceFixture.expectPixels(boxes[0]?.left ?? 0, find(root, mark).getBoundingClientRect().left);
      AppearanceFixture.expectPixels((boxes[0]?.top ?? 0) - card.bottom, px(0.25));
      expect([style.fontSize, style.color, style.borderTopStyle, style.backgroundColor])
        .toEqual([getComputedStyle(find(root, ".notice-text, .check")).fontSize, resolve("var(--nol-link)"), "none", "rgba(0, 0, 0, 0)"]);

      await page.screenshot({ element: find(root, ".dock"), path: `${screenshots}/host-row-boards-${name}-${mode}.png` });
      fixture.destroy();
      TestBed.resetTestingModule();
    }
  });

  it("draws the failure notice's border and error mark in the system's colours, in forced colours", async () => {
    await emulateForcedColorsAsync("active");
    const fixture = await failLinkAsync(ThemeMode.Light);
    const root: HTMLElement = fixture.nativeElement;
    const failed = find(root, "[role=alert]");

    expect([getComputedStyle(failed).borderTopStyle, getComputedStyle(find(failed, ".notice-icon")).color, getComputedStyle(find(failed, ".notice-text")).color])
      .toEqual(["solid", resolve("CanvasText"), resolve("CanvasText")]);
    AppearanceFixture.expectPixels(failed.getBoundingClientRect().top - find(root, ".pr").getBoundingClientRect().bottom, px(0.5));

    await page.screenshot({ element: find(root, ".dock"), path: `${screenshots}/host-row-link-failed-forced.png` });
  });

  it("draws the state and check icons in the system's text colour, the title as a link and the card's border, in forced colours", async () => {
    await emulateForcedColorsAsync("active");
    const fixture = await openAsync(ThemeMode.Light, HostSignIn.signedIn(account), answer);
    const root: HTMLElement = fixture.nativeElement;
    const text = resolve("CanvasText");
    const card = getComputedStyle(find(root, ".pr"));

    expect([getComputedStyle(find(root, ".state")).color, ...all(root, ".check-icon").map(t => getComputedStyle(t).color)])
      .toEqual([text, text, text, text, text]);
    expect([getComputedStyle(find(root, ".title")).color, card.borderTopStyle]).toEqual([resolve("LinkText"), "solid"]);
    expect(all(root, ".check-state").map(t => getComputedStyle(t).color)).toEqual([text, text, text, text]);
    AppearanceFixture.expectPixels(find(root, ".state").getBoundingClientRect().width, px(1));

    await page.screenshot({ element: find(root, ".dock"), path: `${screenshots}/host-row-pull-request-forced.png` });
  });

  it("draws the signed-out line's mark and text in the system's text colour and keeps its border, in forced colours", async () => {
    await emulateForcedColorsAsync("active");
    const fixture = await openAsync(ThemeMode.Light, HostSignIn.signedOut(), null);
    const root: HTMLElement = fixture.nativeElement;
    const notice = find(root, ".notice");

    expect([getComputedStyle(notice).borderTopStyle, getComputedStyle(find(root, ".notice-mark")).color, getComputedStyle(find(root, ".notice-text")).color])
      .toEqual(["solid", resolve("CanvasText"), resolve("CanvasText")]);

    await page.screenshot({ element: find(root, ".dock"), path: `${screenshots}/host-row-signed-out-forced.png` });
  });
});
