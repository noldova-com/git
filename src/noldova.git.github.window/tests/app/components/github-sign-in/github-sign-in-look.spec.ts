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
import { GitHubNames } from "@noldova/git.github.protocol";
import { DeviceCode, HostAccount, HostSignIn, SignInFailure } from "@noldova/git.hosting.protocol";
import { DefaultTheme, ThemeMode } from "@noldova/ui.components.angular";
import { AppearanceFixture } from "@noldova/ui.components.angular/testing";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cdp, page } from "vitest/browser";

import { GitHubSignInComponent } from "../../../../src/app/components/github-sign-in/github-sign-in.component.ts";
import { RequestAnswers } from "../../../fixtures/request-answers.fixture.ts";
import { WindowFailure } from "../../../fixtures/window-failure.fixture.ts";

@Component({
  selector: "nol-git-github-settings-column",
  imports: [GitHubSignInComponent],
  template: "<div class=\"column\"><h2>GitHub</h2><nol-git-github-sign-in /></div>",
  styles: [
    ".column { box-sizing: border-box; width: 49.375rem; padding: 1rem 1.5rem; display: grid; gap: 0.25rem; align-content: start; background: var(--nol-panel); color: var(--nol-text);"
    + " font-family: var(--nol-font-sans); font-size: var(--nol-text-panel); line-height: var(--nol-line-panel); }",
    "h2 { margin: 0 0 0.375rem; font-size: 1.25rem; font-weight: 500; color: var(--nol-setting-title); }"
  ]
})
class SettingsColumnComponent {
}

const NOW: number = 1_800_000_000_000;
const code: DeviceCode = new DeviceCode("WDJB-MJHT", "https://github.com/login/device", NOW + 872_000);
const picture: string = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAQAAAAECAIAAAAmkwkpAAAAEElEQVR4nGNoCrgPRwzEcQC6IhsRLJyGqgAAAABJRU5ErkJggg==";
const account: HostAccount = new HostAccount("example-user", null, picture, ["repo"]);
const states: readonly (readonly [string, HostSignIn | null])[] = [
  ["signed-out", HostSignIn.signedOut()],
  ["code", HostSignIn.waiting(code)],
  ["signed-in", HostSignIn.signedIn(account)],
  ["expired", HostSignIn.signedOut(SignInFailure.Expired)],
  ["unforgotten", HostSignIn.signedOut(SignInFailure.Unforgotten)],
  ["unread", null]
];
const screenshots: string = "../../../../../../_build/github-window/screenshots";
const cases = AppearanceFixture.modes.flatMap(mode => states.map(([name, signIn]) => [mode, name, signIn] as const));

async function openAsync(mode: ThemeMode, signIn: HostSignIn | null,
  prepare: (requests: RequestAnswers) => void = () => undefined): Promise<ComponentFixture<SettingsColumnComponent>> {
  AppearanceFixture.apply(DefaultTheme.theme, mode);
  const context = new FakeWindowPartContext();
  const requests = new RequestAnswers(context);
  if (signIn === null)
    requests.fail(GitHubNames.readSignInMethod, new WindowFailure("Not connected."));
  else
    requests.answer(GitHubNames.readSignInMethod, signIn.toJson());
  prepare(requests);
  TestBed.configureTestingModule({ providers: [{ provide: WindowPartTokens.context, useValue: context }] });
  const fixture = TestBed.createComponent(SettingsColumnComponent);
  await fixture.whenStable();
  fixture.detectChanges();
  await fixture.whenStable();
  return fixture;
}

async function failStartAsync(mode: ThemeMode): Promise<ComponentFixture<SettingsColumnComponent>> {
  const fixture = await openAsync(mode, HostSignIn.signedOut(), requests => requests.fail(GitHubNames.startSignInMethod, new WindowFailure("Not connected.")));
  const root: HTMLElement = fixture.nativeElement;
  [...root.querySelectorAll("button")].find(t => (t.textContent ?? "").includes("Sign in to GitHub"))?.click();
  await fixture.whenStable();
  fixture.detectChanges();
  await fixture.whenStable();
  return fixture;
}

function expectBannerInsets(banner: HTMLElement): void {
  const style = getComputedStyle(banner);
  const box = banner.getBoundingClientRect();
  const icon = find(banner, ".nol-git-github-banner-icon").getBoundingClientRect();
  const text = find(banner, ".nol-git-github-banner-text").getBoundingClientRect();

  AppearanceFixture.expectRem(style.paddingTop, 0.5);
  AppearanceFixture.expectRem(style.paddingLeft, 0.625);
  AppearanceFixture.expectPixels(icon.left - box.left, px(0.625) + 1);
  AppearanceFixture.expectPixels(icon.top - box.top, px(0.5 + 0.125) + 1);
  AppearanceFixture.expectPixels(text.left - icon.right, px(0.5));
  AppearanceFixture.expectPixels(text.top - box.top, px(0.5) + 1);
}

function find(root: HTMLElement, selector: string): HTMLElement {
  const found = root.querySelector(selector);
  if (!(found instanceof HTMLElement))
    throw new Error(`Nothing matches ${selector}.`);
  return found;
}

function tokenColor(token: string): string {
  const probe = document.createElement("span");
  probe.style.color = `var(${token})`;
  document.body.append(probe);
  const color = getComputedStyle(probe).color;
  probe.remove();
  return color;
}

function emulateForcedColorsAsync(value: string): Promise<unknown> {
  return cdp().send("Emulation.setEmulatedMedia", { features: [{ name: "forced-colors", value }] });
}

function colorOf(value: string): string {
  const probe = document.createElement("span");
  probe.style.color = value;
  document.body.append(probe);
  const color = getComputedStyle(probe).color;
  probe.remove();
  return color;
}

function px(rem: number): number {
  return AppearanceFixture.toPixels(rem);
}

describe("GitHubSignInComponent in the kit's look", () => {
  afterEach(async () => {
    try {
      vi.useRealTimers();
    }
    finally {
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
    }
  });

  it.each(states)("reaches out by Settings' edge as Settings' own rows do, so its edges line up with theirs, %s", async (_name, signIn) => {
    vi.useFakeTimers({ now: NOW, toFake: ["Date", "setInterval", "clearInterval"] });
    const fixture = await openAsync(ThemeMode.Light, signIn);
    const root: HTMLElement = fixture.nativeElement;
    const before = find(root, "section").getBoundingClientRect();
    find(root, ".column").style.setProperty("--nol-settings-edge", "0.875rem");
    const after = find(root, "section").getBoundingClientRect();

    AppearanceFixture.expectPixels(after.left, before.left - px(0.875));
    AppearanceFixture.expectPixels(after.right, before.right + px(0.875));
  });

  it.each(cases)("sets its section inside the settings column as the design does, in %s mode, %s", async (mode, name, signIn) => {
    vi.useFakeTimers({ now: NOW, toFake: ["Date", "setInterval", "clearInterval"] });
    const fixture = await openAsync(mode, signIn);
    const root: HTMLElement = fixture.nativeElement;
    const column = find(root, ".column").getBoundingClientRect();
    const heading = find(root, "h2").getBoundingClientRect();
    const section = find(root, "section").getBoundingClientRect();
    const title = find(root, "h3").getBoundingClientRect();
    const sectionStyle = getComputedStyle(find(root, "section"));

    AppearanceFixture.expectPixels(heading.left - column.left, px(1.5));
    AppearanceFixture.expectPixels(heading.top - column.top, px(1));
    AppearanceFixture.expectPixels(section.top - heading.bottom, px(0.375 + 0.25));
    AppearanceFixture.expectPixels(title.left - section.left, px(0.875));
    AppearanceFixture.expectPixels(title.top - section.top, px(0.75));
    AppearanceFixture.expectRem(sectionStyle.rowGap, 0.5625);
    AppearanceFixture.expectRem(sectionStyle.paddingBottom, 1.125);
    expect(getComputedStyle(find(root, "h3")).fontWeight).toBe(getComputedStyle(document.documentElement).getPropertyValue("--nol-weight-emphasis").trim());
    for (const row of root.querySelectorAll(".nol-git-github-row")) {
      const buttons = [...row.querySelectorAll("button")].map(t => t.getBoundingClientRect());
      for (const [before, after] of buttons.slice(1).map((t, i) => [buttons[i], t] as const))
        expect(after.left - (before?.right ?? after.left)).toBeGreaterThanOrEqual(px(0.5) - 1 / 32);
      const first = row.firstElementChild?.getBoundingClientRect().left ?? title.left;
      AppearanceFixture.expectPixels(first, title.left);
    }

    await page.screenshot({ element: find(root, ".column"), path: `${screenshots}/sign-in-${name}-${mode}.png` });
  });

  it.each(cases)("marks each row Settings search opens at on a box inside the section, the Account row from its title's start to the section's content end, an action's row on its button alone, in %s mode, %s", async (mode, _name, signIn) => {
    vi.useFakeTimers({ now: NOW, toFake: ["Date", "setInterval", "clearInterval"] });
    const fixture = await openAsync(mode, signIn);
    const root: HTMLElement = fixture.nativeElement;
    const section = find(root, "section");
    const sectionBox = section.getBoundingClientRect();
    const sectionStyle = getComputedStyle(section);
    const title = find(root, "h3").getBoundingClientRect();
    const marks = [...root.querySelectorAll<HTMLElement>("[data-setting]")];

    expect(marks.length).toBeGreaterThan(0);
    for (const mark of marks) {
      const box = mark.getBoundingClientRect();
      const buttons = [...mark.querySelectorAll("button")];
      expect([box.width > 0, box.height > 0, box.top >= sectionBox.top, box.bottom <= sectionBox.bottom]).toEqual([true, true, true, true]);
      if (mark.getAttribute("data-setting") === "git-github.account") {
        expect(buttons).toEqual([]);
        AppearanceFixture.expectPixels(box.left, title.left);
        AppearanceFixture.expectPixels(box.right, sectionBox.right - Number.parseFloat(sectionStyle.paddingRight));
        AppearanceFixture.expectPixels(box.top, title.top);
        continue;
      }
      expect(buttons).toHaveLength(1);
      const button = buttons[0]?.getBoundingClientRect() ?? box;
      for (const [edge, value] of [[box.left, button.left], [box.right, button.right], [box.top, button.top], [box.bottom, button.bottom]] as const)
        AppearanceFixture.expectPixels(edge, value);
    }
  });

  it.each(AppearanceFixture.modes)("draws the code large and dashed, with the wait's row under it, in %s mode", async mode => {
    vi.useFakeTimers({ now: NOW, toFake: ["Date", "setInterval", "clearInterval"] });
    const fixture = await openAsync(mode, HostSignIn.waiting(code));
    const root: HTMLElement = fixture.nativeElement;
    const box = find(root, ".nol-git-github-code");
    const style = getComputedStyle(box);
    const cancel = find(root, ".nol-git-github-cancel").getBoundingClientRect();
    const timer = find(root, "[role=timer]").getBoundingClientRect();

    AppearanceFixture.expectRem(style.fontSize, 1.75);
    AppearanceFixture.expectRem(style.paddingTop, 0.375);
    AppearanceFixture.expectRem(style.paddingLeft, 0.875);
    expect([style.borderTopStyle, style.borderTopWidth]).toEqual(["dashed", "1px"]);
    AppearanceFixture.expectPixels(cancel.left - timer.right, px(0.5 + 0.5));
  });

  it.each(AppearanceFixture.modes)("sets the account's avatar beside its name, in %s mode", async mode => {
    const fixture = await openAsync(mode, HostSignIn.signedIn(account));
    const root: HTMLElement = fixture.nativeElement;
    const avatar = find(root, "nol-avatar").getBoundingClientRect();
    const text = find(root, ".nol-git-github-account-text").getBoundingClientRect();

    AppearanceFixture.expectPixels(avatar.width, px(1.75));
    AppearanceFixture.expectPixels(text.left - avatar.right, px(0.625));
    AppearanceFixture.expectPixels(avatar.top + avatar.height / 2, text.top + text.height / 2);
  });

  it.each(AppearanceFixture.modes)("draws the account's picture filling its avatar, and its initial at the same size when it has none, in %s mode", async mode => {
    const pictured = await openAsync(mode, HostSignIn.signedIn(account));
    const image = find(pictured.nativeElement, "nol-avatar img");
    if (!(image instanceof HTMLImageElement))
      throw new Error("The avatar has no image.");
    await image.decode();
    const [box, shown] = [find(pictured.nativeElement, "nol-avatar").getBoundingClientRect(), image.getBoundingClientRect()];
    TestBed.resetTestingModule();
    const plain = await openAsync(mode, HostSignIn.signedIn(new HostAccount("example-user", null, null, ["repo"])));
    const initial = find(plain.nativeElement, "nol-avatar");

    expect([image.getAttribute("src"), image.complete, image.naturalWidth]).toEqual([picture, true, 4]);
    for (const [size, expected] of [[box.width, px(1.75)], [box.height, px(1.75)], [shown.width, box.width], [shown.height, box.height], [shown.left, box.left],
      [shown.top, box.top]] as const)
      AppearanceFixture.expectPixels(size, expected);
    expect([initial.querySelector("img"), initial.textContent?.trim()]).toEqual([null, "E"]);
    AppearanceFixture.expectPixels(initial.getBoundingClientRect().width, px(1.75));
    AppearanceFixture.expectPixels(initial.getBoundingClientRect().height, px(1.75));
  });

  it("frames the account's picture and its initial in the system's text colour, the picture inside the border, in forced colours", async () => {
    await emulateForcedColorsAsync("active");
    const pictured = await openAsync(ThemeMode.Light, HostSignIn.signedIn(account));
    const avatar = find(pictured.nativeElement, "nol-avatar");
    const image = find(avatar, "img");
    if (!(image instanceof HTMLImageElement))
      throw new Error("The avatar has no image.");
    await image.decode();
    const style = getComputedStyle(avatar);
    const border = Number.parseFloat(style.borderLeftWidth);
    const [box, shown] = [avatar.getBoundingClientRect(), image.getBoundingClientRect()];
    const pictureLook = [style.borderLeftStyle, style.borderLeftColor];
    TestBed.resetTestingModule();
    const plain = await openAsync(ThemeMode.Light, HostSignIn.signedIn(new HostAccount("example-user", null, null, ["repo"])));
    const initial = find(plain.nativeElement, "nol-avatar");
    const initialStyle = getComputedStyle(initial);

    expect(matchMedia("(forced-colors: active)").matches).toBe(true);
    expect(border).toBeGreaterThan(0);
    expect([pictureLook, [initialStyle.borderLeftStyle, initialStyle.borderLeftColor]]).toEqual([["solid", colorOf("CanvasText")], ["solid", colorOf("CanvasText")]]);
    for (const [size, expected] of [[box.width, px(1.75)], [box.height, px(1.75)], [shown.left, box.left + border], [shown.top, box.top + border],
      [shown.width, box.width - 2 * border], [shown.height, box.height - 2 * border], [initial.getBoundingClientRect().width, px(1.75)],
      [initial.getBoundingClientRect().height, px(1.75)]] as const)
      AppearanceFixture.expectPixels(size, expected);
    expect([initial.querySelector("img"), initial.textContent?.trim()]).toEqual([null, "E"]);
  });

  it.each(AppearanceFixture.modes)("frames a sign-in that couldn't be read in a raised banner under the Account title, with Try again on the title's edge, in %s mode", async mode => {
    const fixture = await openAsync(mode, null);
    const root: HTMLElement = fixture.nativeElement;
    const banner = find(root, "[role=alert]");
    const box = banner.getBoundingClientRect();
    const title = find(root, "h3").getBoundingClientRect();
    const section = find(root, "section");
    const sectionBox = section.getBoundingClientRect();
    const retry = find(root, ".nol-git-github-row button").getBoundingClientRect();

    expectBannerInsets(banner);
    AppearanceFixture.expectPixels(box.left, title.left);
    AppearanceFixture.expectPixels(box.right, sectionBox.right - Number.parseFloat(getComputedStyle(section).paddingRight));
    AppearanceFixture.expectPixels(box.top - title.bottom, px(0.5625));
    AppearanceFixture.expectPixels(retry.left, title.left);
    AppearanceFixture.expectPixels(retry.top - box.bottom, px(0.5625));
    expect([getComputedStyle(find(root, ".nol-git-github-banner-icon")).color, getComputedStyle(banner).backgroundColor, getComputedStyle(banner).borderTopStyle])
      .toEqual([tokenColor("--nol-error"), tokenColor("--nol-raised"), "solid"]);

    await page.screenshot({ element: find(root, ".column"), path: `${screenshots}/sign-in-unread-banner-${mode}.png` });
  });

  it.each(AppearanceFixture.modes)("frames a request that failed in a raised banner at the section's end, on the title's edges, a gap under the rows, in %s mode", async mode => {
    const fixture = await failStartAsync(mode);
    const root: HTMLElement = fixture.nativeElement;
    const section = find(root, "section");
    const sectionBox = section.getBoundingClientRect();
    const banner = section.lastElementChild;
    if (!(banner instanceof HTMLElement))
      throw new Error("The section has no last element.");
    const box = banner.getBoundingClientRect();
    const title = find(root, "h3").getBoundingClientRect();
    const rows = [...section.querySelectorAll(".nol-git-github-row")];

    expect([banner.getAttribute("role"), find(banner, ".nol-git-github-strong").textContent?.trim()]).toEqual(["alert", "GitHub's sign-in didn't answer."]);
    expectBannerInsets(banner);
    AppearanceFixture.expectPixels(box.left, title.left);
    AppearanceFixture.expectPixels(box.right, sectionBox.right - Number.parseFloat(getComputedStyle(section).paddingRight));
    AppearanceFixture.expectPixels(box.top - (rows.at(-1)?.getBoundingClientRect().bottom ?? 0), px(0.5625));
    AppearanceFixture.expectPixels(sectionBox.bottom - box.bottom, px(1.125));
    expect(getComputedStyle(find(banner, ".nol-git-github-banner-icon")).color).toBe(tokenColor("--nol-error"));

    await page.screenshot({ element: find(root, ".column"), path: `${screenshots}/sign-in-request-failed-${mode}.png` });
  });

  it("draws the request-failed banner's border, error mark and text in the system's colours, in forced colours", async () => {
    await emulateForcedColorsAsync("active");
    const fixture = await failStartAsync(ThemeMode.Light);
    const root: HTMLElement = fixture.nativeElement;
    const banner = find(root, "[role=alert]");

    expect(matchMedia("(forced-colors: active)").matches).toBe(true);
    expect([getComputedStyle(banner).borderTopStyle, getComputedStyle(find(banner, ".nol-git-github-banner-icon")).color,
      getComputedStyle(find(banner, ".nol-git-github-strong")).color]).toEqual(["solid", colorOf("CanvasText"), colorOf("CanvasText")]);
    expectBannerInsets(banner);

    await page.screenshot({ element: find(root, ".column"), path: `${screenshots}/sign-in-request-failed-forced.png` });
  });

  it.each(AppearanceFixture.modes)("frames why the sign-in ended in a raised banner with the error mark, in %s mode", async mode => {
    const fixture = await openAsync(mode, HostSignIn.signedOut(SignInFailure.Expired));
    const root: HTMLElement = fixture.nativeElement;
    const banner = find(root, "[role=alert]");
    const style = getComputedStyle(banner);
    const icon = find(root, ".nol-git-github-banner-icon").getBoundingClientRect();
    const box = banner.getBoundingClientRect();

    AppearanceFixture.expectRem(style.paddingTop, 0.5);
    AppearanceFixture.expectRem(style.paddingLeft, 0.625);
    AppearanceFixture.expectPixels(icon.left - box.left, px(0.625) + 1);
    AppearanceFixture.expectPixels(icon.top - box.top, px(0.5 + 0.125) + 1);
    expect([getComputedStyle(find(root, ".nol-git-github-banner-icon")).color, style.backgroundColor]).toEqual([tokenColor("--nol-error"), tokenColor("--nol-raised")]);
  });
});
