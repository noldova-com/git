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
import "@noldova/context.core";
import { WindowPartTokens } from "@noldova/desktop.window";
import { FakeWindowPartContext } from "@noldova/desktop.window/testing";
import { GitHubNames } from "@noldova/git.github.protocol";
import { BranchPullRequest, CheckState, DeviceCode, HostAccount, HostChanges, HostCheck, HostItem, HostReference, HostSignIn, ReferenceKind,
  ReferenceState } from "@noldova/git.hosting.protocol";
import { GitRemote, RemoteTransport } from "@noldova/git.protocol";
import { DefaultTheme, ThemeMode } from "@noldova/ui.components.angular";
import { AppearanceFixture, PointerFixture, TooltipFixture } from "@noldova/ui.components.angular/testing";
import { afterEach, describe, expect, it } from "vitest";
import { cdp, page } from "vitest/browser";

import { GitHubHostRowComponent } from "../../../../src/app/components/github-host-row/github-host-row.component.ts";
import { RequestAnswers } from "../../../fixtures/request-answers.fixture.ts";
import { WindowFailure } from "../../../fixtures/window-failure.fixture.ts";

@Component({
  selector: "nol-git-github-dock",
  imports: [GitHubHostRowComponent],
  template: "<div class=\"dock\"><nol-git-github-host-row folder=\"/work/example-repository\" branch=\"feature/readme\" [head]=\"null\" [remote]=\"remote\" /></div>",
  styles: [
    ".dock { box-sizing: border-box; width: 25rem; padding: 0.75rem; background: var(--nol-panel); color: var(--nol-text);"
    + " font-family: var(--nol-font-sans); font-size: var(--nol-text-panel); line-height: var(--nol-line-panel); }"
  ]
})
class DockComponent {
  protected readonly remote: GitRemote = new GitRemote("origin", "github.com", "example-owner/example-repository", RemoteTransport.Https);
}

const account: HostAccount = new HostAccount("example-user", null, null, ["repo"]);
const code: DeviceCode = new DeviceCode("WDJB-MJHT", "https://github.com/login/device", 1_800_000_872_000);
const title: string = "Sample merged pull request with a long title that runs on past the width of the row, so the row cuts it";
const runs: string = "https://github.com/example-owner/example-repository/actions/runs/";
const longCheck: string = "Sample check with a long name (Linux x64) that runs on past the width of the row, so the row cuts it short at its end, with a few more words added";
const merged: HostItem = new HostItem(new HostReference("git-github", "example-owner", "example-repository", 1234), ReferenceKind.PullRequest, ReferenceState.Merged,
  title, "https://github.com/example-owner/example-repository/pull/1234", null, 1_800_000_000_000, 1_800_000_360_000, 0,
  new HostChanges(12, 1, 2, "feature/readme", "main", "0123456789abcdef0123456789abcdef01234567"));
const answer: BranchPullRequest = new BranchPullRequest(merged, [
  new HostCheck("Linux x64", CheckState.Succeeded, `${runs}1`),
  new HostCheck("macOS arm64", CheckState.Running, `${runs}2`),
  new HostCheck(longCheck, CheckState.Succeeded, `${runs}3`),
  new HostCheck("Windows x64", CheckState.Failed, `${runs}4`)
]);
const screenshots: string = "../../../../../../_build/github-window/screenshots";
const purple: Readonly<Record<ThemeMode, string>> = { [ThemeMode.Light]: "rgb(130, 80, 223)", [ThemeMode.Dark]: "rgb(163, 113, 247)" };

async function openAsync(mode: ThemeMode, signIn: HostSignIn, pullRequest: BranchPullRequest | null,
  prepare: (context: FakeWindowPartContext, requests: RequestAnswers) => void = () => undefined): Promise<ComponentFixture<DockComponent>> {
  AppearanceFixture.apply(DefaultTheme.theme, mode);
  const context = new FakeWindowPartContext();
  const requests = new RequestAnswers(context);
  requests.answer(GitHubNames.readSignInMethod, signIn.toJson());
  if (!Object.isNull(pullRequest))
    requests.answer(GitHubNames.readBranchPullRequestMethod, pullRequest.toJson());
  prepare(context, requests);
  TestBed.configureTestingModule({ providers: [{ provide: WindowPartTokens.context, useValue: context }, TooltipFixture.atOnce] });
  const fixture = TestBed.createComponent(DockComponent);
  fixture.autoDetectChanges();
  await fixture.whenStable();
  return fixture;
}

function find(root: HTMLElement, selector: string): HTMLElement {
  const found = root.querySelector(selector);
  if (!(found instanceof HTMLElement))
    throw new Error(`Nothing matches ${selector}.`);
  return found;
}

async function failLinkAsync(mode: ThemeMode): Promise<ComponentFixture<DockComponent>> {
  const fixture = await openAsync(mode, HostSignIn.signedOut(), null, (context, requests) => {
    requests.answer(GitHubNames.startSignInMethod, HostSignIn.waiting(code).toJson());
    context.answer("openLinkAsync", async () => {
      throw new WindowFailure("No browser.");
    });
  });
  const signIn = [...all(fixture.nativeElement, "button")].find(t => (t.textContent ?? "").includes("Sign in to GitHub"));
  signIn?.click();
  await fixture.whenStable();
  fixture.detectChanges();
  await fixture.whenStable();
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

describe("GitHubHostRowComponent in the kit's look", () => {
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

    for (const target of [find(root, ".name"), find(root, ".title"), all(root, ".name").at(-1) ?? find(root, ".name")]) {
      await PointerFixture.hoverAsync(target);
      await fixture.whenStable();
      shown.push(document.querySelector("nol-tooltip")?.textContent?.trim() ?? null);
    }

    expect(shown).toEqual([null, `#1234 ${title}`, longCheck]);
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
    const labels = all(root, ".check-state").map(t => t.getBoundingClientRect());

    AppearanceFixture.expectPixels(state.left - card.left, px(0.625) + border);
    AppearanceFixture.expectPixels(state.width, px(1));
    AppearanceFixture.expectPixels(titleBox.left - state.right, px(0.5));
    AppearanceFixture.expectPixels(open.left - titleBox.right, px(0.5));
    AppearanceFixture.expectPixels(card.right - open.right, px(0.625) + border);
    AppearanceFixture.expectPixels(line.top - card.top, px(0.5) + border);
    AppearanceFixture.expectTruncates(find(root, ".title .text"));
    AppearanceFixture.expectTruncates(all(root, ".name .text").at(-1) ?? find(root, ".name .text"));
    expect(checks.map(t => t.getBoundingClientRect().height >= px(1.375) - 1 / 32)).toEqual([true, true, true, true]);
    AppearanceFixture.expectPixels((checks[0]?.getBoundingClientRect().top ?? 0) - line.bottom, px(0.25 + 0.125));
    AppearanceFixture.expectPixels(card.bottom - (checks.at(-1)?.getBoundingClientRect().bottom ?? 0), px(0.5) + border);
    for (const icon of icons)
      AppearanceFixture.expectPixels(icon.left, state.left);
    for (const label of labels)
      AppearanceFixture.expectPixels(label.right, card.right - px(0.625) - border);
    expect(getComputedStyle(find(root, ".state")).backgroundColor).toBe(purple[mode]);
    expect(getComputedStyle(find(root, ".title")).color).toBe(resolve("var(--nol-link)"));
    expect(all(root, ".check-state").map(t => getComputedStyle(t).color)).toEqual([resolve("var(--nol-status-failed)"), resolve("var(--nol-text-muted)"),
      resolve("var(--nol-status-ok)"), resolve("var(--nol-status-ok)")]);
    expect(all(root, ".check-icon").map(t => getComputedStyle(t).backgroundColor)).toEqual([resolve("var(--nol-status-failed)"),
      resolve("var(--nol-text-muted)"), resolve("var(--nol-status-ok)"), resolve("var(--nol-status-ok)")]);

    await page.screenshot({ element: find(root, ".dock"), path: `${screenshots}/host-row-pull-request-${mode}.png` });
  });

  it.each(AppearanceFixture.modes)("draws each pull request state's icon in GitHub's colour for that state, in %s mode", async mode => {
    const states: readonly (readonly [ReferenceState, string | null, number | null])[] = [[ReferenceState.Open, "var(--nol-status-ok)", null],
      [ReferenceState.Draft, "var(--nol-text-muted)", null], [ReferenceState.Closed, "var(--nol-status-failed)", 1_800_000_360_000],
      [ReferenceState.Merged, null, 1_800_000_360_000]];
    const shown: string[] = [];
    const expected: string[] = [];
    for (const [state, colour, closedAt] of states) {
      const item = new HostItem(merged.reference, ReferenceKind.PullRequest, state, "Sample pull request", merged.url, null, merged.createdAt, closedAt, 0,
        merged.changes);
      const fixture = await openAsync(mode, HostSignIn.signedIn(account), new BranchPullRequest(item, []));
      shown.push(getComputedStyle(find(fixture.nativeElement, ".state")).backgroundColor);
      expected.push(Object.isNull(colour) ? purple[mode] : resolve(colour));
      await page.screenshot({ element: find(fixture.nativeElement, ".dock"), path: `${screenshots}/host-row-state-${state}-${mode}.png` });
      fixture.destroy();
      TestBed.resetTestingModule();
    }

    expect(shown).toEqual(expected);
  });

  it.each(AppearanceFixture.modes)("sets the signed-out and no pull request lines' mark, text and button on the card's insets, in %s mode", async mode => {
    for (const [name, signIn, pullRequest] of [["signed-out", HostSignIn.signedOut(), null],
      ["no-pull-request", HostSignIn.signedIn(account), new BranchPullRequest(null, [])]] as const) {
      const fixture = await openAsync(mode, signIn, pullRequest);
      const root: HTMLElement = fixture.nativeElement;
      const card = find(root, ".notice").getBoundingClientRect();
      const border = Number.parseFloat(getComputedStyle(find(root, ".notice")).borderLeftWidth);
      const mark = find(root, ".notice-mark").getBoundingClientRect();
      const text = find(root, ".notice-text").getBoundingClientRect();
      const style = getComputedStyle(find(root, ".notice"));

      AppearanceFixture.expectPixels(mark.left - card.left, px(0.625) + border);
      AppearanceFixture.expectPixels(mark.width, px(1));
      AppearanceFixture.expectPixels(text.left - mark.right, Number.parseFloat(style.columnGap));
      AppearanceFixture.expectPixels(mark.top + mark.height / 2, text.top + text.height / 2);
      expect([style.borderTopStyle, style.backgroundColor, getComputedStyle(find(root, ".notice-mark")).backgroundColor])
        .toEqual(["solid", resolve("var(--nol-raised)"), style.color]);
      for (const button of all(root, "button"))
        AppearanceFixture.expectPixels(card.right - button.getBoundingClientRect().right, px(0.625) + border);

      await page.screenshot({ element: find(root, ".dock"), path: `${screenshots}/host-row-${name}-${mode}.png` });
      fixture.destroy();
      TestBed.resetTestingModule();
    }
  });

  it.each(AppearanceFixture.modes)("sets the unanswered notice's error mark, its wrapping text and Try again on the card's insets, in %s mode", async mode => {
    const fixture = await openAsync(mode, HostSignIn.signedIn(account), null,
      (_, requests) => requests.fail(GitHubNames.readBranchPullRequestMethod, new WindowFailure("GitHub didn't answer.")));
    const root: HTMLElement = fixture.nativeElement;
    const notice = find(root, "[role=alert]");

    expect(all(root, ".notice")).toHaveLength(1);
    expectFailureNotice(notice);
    expect([getComputedStyle(notice).borderTopStyle, getComputedStyle(notice).backgroundColor, getComputedStyle(find(notice, ".notice-icon")).color])
      .toEqual(["solid", resolve("var(--nol-raised)"), resolve("var(--nol-status-failed)")]);
    AppearanceFixture.expectPixels(find(root, ".dock").getBoundingClientRect().width - notice.getBoundingClientRect().width, px(0.75 * 2));

    await page.screenshot({ element: find(root, ".dock"), path: `${screenshots}/host-row-unanswered-${mode}.png` });
  });

  it.each(AppearanceFixture.modes)("keeps the code's notice and sets the page-not-opened notice under it, a gap apart, on the same insets, in %s mode", async mode => {
    const fixture = await failLinkAsync(mode);
    const root: HTMLElement = fixture.nativeElement;
    const [codeNotice, failed] = all(root, ".notice");
    if (Object.isUndefined(codeNotice) || Object.isUndefined(failed))
      throw new Error("The row shows fewer than two notices.");
    const codeBox = codeNotice.getBoundingClientRect();
    const failedBox = failed.getBoundingClientRect();

    expect([codeNotice.getAttribute("role"), failed.getAttribute("role"), all(root, ".notice").length]).toEqual([null, "alert", 2]);
    expectFailureNotice(failed);
    AppearanceFixture.expectPixels(failedBox.top - codeBox.bottom, px(0.5));
    AppearanceFixture.expectPixels(failedBox.left, codeBox.left);
    AppearanceFixture.expectPixels(failedBox.right, codeBox.right);
    expect(getComputedStyle(find(failed, ".notice-icon")).color).toBe(resolve("var(--nol-status-failed)"));

    await page.screenshot({ element: find(root, ".dock"), path: `${screenshots}/host-row-link-failed-${mode}.png` });
  });

  it("draws the failure notices' border and error mark in the system's colours, in forced colours", async () => {
    await emulateForcedColorsAsync("active");
    const fixture = await failLinkAsync(ThemeMode.Light);
    const root: HTMLElement = fixture.nativeElement;
    const failed = find(root, "[role=alert]");

    expect([getComputedStyle(failed).borderTopStyle, getComputedStyle(find(failed, ".notice-icon")).color, getComputedStyle(find(failed, ".notice-text")).color])
      .toEqual(["solid", resolve("CanvasText"), resolve("CanvasText")]);
    AppearanceFixture.expectPixels(failed.getBoundingClientRect().top - find(root, ".notice").getBoundingClientRect().bottom, px(0.5));

    await page.screenshot({ element: find(root, ".dock"), path: `${screenshots}/host-row-link-failed-forced.png` });
  });

  it("draws the state and check icons in the system's text colour, the title as a link and the card's border, in forced colours", async () => {
    await emulateForcedColorsAsync("active");
    const fixture = await openAsync(ThemeMode.Light, HostSignIn.signedIn(account), answer);
    const root: HTMLElement = fixture.nativeElement;
    const text = resolve("CanvasText");
    const card = getComputedStyle(find(root, ".pr"));

    expect([getComputedStyle(find(root, ".state")).backgroundColor, ...all(root, ".check-icon").map(t => getComputedStyle(t).backgroundColor)])
      .toEqual([text, text, text, text, text]);
    expect([getComputedStyle(find(root, ".title")).color, card.borderTopStyle]).toEqual([resolve("LinkText"), "solid"]);
    expect(all(root, ".check-state").map(t => getComputedStyle(t).color)).toEqual([text, text, text, text]);

    await page.screenshot({ element: find(root, ".dock"), path: `${screenshots}/host-row-pull-request-forced.png` });
  });
});
