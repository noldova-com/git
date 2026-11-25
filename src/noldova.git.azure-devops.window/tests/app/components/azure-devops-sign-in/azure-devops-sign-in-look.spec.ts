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
import { AzureDevOpsNames } from "@noldova/git.azure-devops.protocol";
import { HostAccount, HostSignIn, SignInFailure } from "@noldova/git.hosting.protocol";
import { DefaultTheme, ThemeMode } from "@noldova/ui.components.angular";
import { AppearanceFixture } from "@noldova/ui.components.angular/testing";
import { afterEach, describe, expect, it } from "vitest";
import { cdp, page } from "vitest/browser";

import { AzureDevOpsSignInComponent } from "../../../../src/app/components/azure-devops-sign-in/azure-devops-sign-in.component.ts";
import { RequestAnswers } from "../../../fixtures/request-answers.fixture.ts";
import { WindowFailure } from "../../../fixtures/window-failure.fixture.ts";

/** A sign-in the settings show, by the name its screenshot takes; null when the read fails. */
interface ISignInState {
  readonly name: string;
  readonly signIn: HostSignIn | null;
}

@Component({
  selector: "nol-git-azure-devops-settings-column",
  imports: [AzureDevOpsSignInComponent],
  template: "<div class=\"column\"><h2>Azure DevOps</h2><nol-git-azure-devops-sign-in /></div>",
  styles: [
    ".column { box-sizing: border-box; width: 49.375rem; padding: 1rem 1.5rem; display: grid; gap: 0.25rem; align-content: start; background: var(--nol-panel); color: var(--nol-text);"
    + " font-family: var(--nol-font-sans); font-size: var(--nol-text-panel); line-height: var(--nol-line-panel); }",
    "h2 { margin: 0 0 0.375rem; font-size: 1.25rem; font-weight: 500; color: var(--nol-setting-title); }"
  ]
})
class SettingsColumnComponent {
}

const account: HostAccount = new HostAccount("monalisa@example.com", "Mona Lisa", null, []);
const states: readonly ISignInState[] = [
  { name: "signed-out", signIn: HostSignIn.signedOut() },
  { name: "signed-in", signIn: HostSignIn.signedIn(account) },
  { name: "waiting", signIn: HostSignIn.waitingInBrowser("https://login.microsoftonline.com/organizations/oauth2/v2.0/authorize?client_id=contoso") },
  { name: "refused", signIn: HostSignIn.signedOut(SignInFailure.Refused) },
  { name: "unforgotten", signIn: HostSignIn.signedOut(SignInFailure.Unforgotten) },
  { name: "unread", signIn: null }
];
const tokenStates: readonly ISignInState[] = [
  { name: "signed-out", signIn: HostSignIn.signedOut() },
  { name: "refused", signIn: HostSignIn.signedOut(SignInFailure.Refused) }
];
const screenshots: string = "../../../../../../_build/azure-devops-window/screenshots";
const cases = AppearanceFixture.modes.flatMap(mode => states.map(({ name, signIn }) => [mode, name, signIn] as const));
const tokenCases = AppearanceFixture.modes.flatMap(mode => tokenStates.map(({ name, signIn }) => [mode, name, signIn] as const));

async function openAsync(mode: ThemeMode, signIn: HostSignIn | null,
  prepare: (requests: RequestAnswers) => void = () => undefined): Promise<ComponentFixture<SettingsColumnComponent>> {
  AppearanceFixture.apply(DefaultTheme.theme, mode);
  const context = new FakeWindowPartContext();
  const requests = new RequestAnswers(context);
  if (Object.isNull(signIn))
    requests.fail(AzureDevOpsNames.readSignInMethod, new WindowFailure("Not connected."));
  else
    requests.answer(AzureDevOpsNames.readSignInMethod, signIn.toJson());
  prepare(requests);
  TestBed.configureTestingModule({ providers: [{ provide: WindowPartTokens.context, useValue: context }] });
  const fixture = TestBed.createComponent(SettingsColumnComponent);
  await settleAsync(fixture);
  return fixture;
}

async function settleAsync(fixture: ComponentFixture<SettingsColumnComponent>): Promise<void> {
  await fixture.whenStable();
  fixture.detectChanges();
  await fixture.whenStable();
}

async function failSignInAsync(mode: ThemeMode): Promise<ComponentFixture<SettingsColumnComponent>> {
  const fixture = await openAsync(mode, HostSignIn.signedOut(),
    requests => requests.fail(AzureDevOpsNames.signInWithTokenMethod, new WindowFailure("Not connected.")));
  const root: HTMLElement = fixture.nativeElement;
  const organization = find(root, ".nol-git-azure-devops-organization");
  const field = find(root, ".nol-git-azure-devops-token");
  if (!(organization instanceof HTMLInputElement) || !(field instanceof HTMLInputElement))
    throw new Error("The page has no organization or token field.");
  organization.value = "fabrikam";
  organization.dispatchEvent(new Event("input"));
  field.value = "example-token-value";
  field.dispatchEvent(new Event("input"));
  await settleAsync(fixture);
  find(root, ".nol-git-azure-devops-token-row button").click();
  await settleAsync(fixture);
  return fixture;
}

function expectBannerInsets(banner: HTMLElement): void {
  const style = getComputedStyle(banner);
  const box = banner.getBoundingClientRect();
  const icon = find(banner, ".nol-git-azure-devops-banner-icon").getBoundingClientRect();
  const text = find(banner, ".nol-git-azure-devops-banner-text").getBoundingClientRect();

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

function contentRight(section: HTMLElement): number {
  return section.getBoundingClientRect().right - Number.parseFloat(getComputedStyle(section).paddingRight);
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

describe("AzureDevOpsSignInComponent in the kit's look", () => {
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

  it.each(states)("reaches out by Settings' edge as Settings' own rows do, so its edges line up with theirs, $name", async ({ signIn }) => {
    const fixture = await openAsync(ThemeMode.Light, signIn);
    const root: HTMLElement = fixture.nativeElement;
    const before = find(root, "section").getBoundingClientRect();
    find(root, ".column").style.setProperty("--nol-settings-edge", "0.875rem");
    const after = find(root, "section").getBoundingClientRect();

    AppearanceFixture.expectPixels(after.left, before.left - px(0.875));
    AppearanceFixture.expectPixels(after.right, before.right + px(0.875));
  });

  it.each(cases)("sets its section inside the settings column as the design does, in %s mode, %s", async (mode, name, signIn) => {
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
    for (const row of root.querySelectorAll(".nol-git-azure-devops-row")) {
      const buttons = [...row.querySelectorAll("button")].map(t => t.getBoundingClientRect());
      for (const [before, after] of buttons.slice(1).map((t, i) => [buttons[i], t] as const))
        expect(after.left - (before?.right ?? after.left)).toBeGreaterThanOrEqual(px(0.5) - 1 / 32);
      const first = row.firstElementChild?.getBoundingClientRect().left ?? title.left;
      AppearanceFixture.expectPixels(first, title.left);
    }
    for (const note of root.querySelectorAll("p"))
      AppearanceFixture.expectPixels(note.getBoundingClientRect().left, title.left);

    await page.screenshot({ element: find(root, ".column"), path: `${screenshots}/sign-in-${name}-${mode}.png` });
  });

  it.each(tokenCases)("sets the token field on the title's edge, filling the row up to Sign in, which ends on the section's content edge, with the scopes it needs listed under its note, in %s mode, %s", async (mode, _name, signIn) => {
    const fixture = await openAsync(mode, signIn);
    const root: HTMLElement = fixture.nativeElement;
    const section = find(root, "section");
    const row = find(root, ".nol-git-azure-devops-token-row");
    const field = find(row, "input").getBoundingClientRect();
    const button = find(row, "button").getBoundingClientRect();
    const title = find(root, "h3").getBoundingClientRect();
    const note = find(root, ".nol-git-azure-devops-token-row + p").getBoundingClientRect();
    const scopes = find(root, ".nol-git-azure-devops-token-row + p + ul").getBoundingClientRect();
    const scope = find(root, ".nol-git-azure-devops-token-row + p + ul li").getBoundingClientRect();
    const make = root.querySelector(".nol-git-azure-devops-token-row + p + ul + .nol-git-azure-devops-row button")?.getBoundingClientRect();

    AppearanceFixture.expectPixels(field.left, title.left);
    AppearanceFixture.expectPixels(button.left - field.right, px(0.5));
    AppearanceFixture.expectPixels(button.right, contentRight(section));
    AppearanceFixture.expectPixels(field.top + field.height / 2, button.top + button.height / 2);
    expect(field.width).toBeGreaterThan(px(20));
    AppearanceFixture.expectPixels(note.left, title.left);
    AppearanceFixture.expectPixels(note.top - row.getBoundingClientRect().bottom, px(0.1875));
    AppearanceFixture.expectPixels(scopes.left, title.left);
    AppearanceFixture.expectPixels(scope.left - title.left, px(1.25));
    AppearanceFixture.expectPixels(scopes.top - note.bottom, px(0.1875));
    AppearanceFixture.expectPixels(make?.left ?? 0, title.left);
    AppearanceFixture.expectPixels((make?.top ?? 0) - scopes.bottom, px(0.5625));
  });

  it.each(tokenCases)("sets the organization field from the title's edge to the section's content edge, a control gap above the token row, in %s mode, %s", async (mode, _name, signIn) => {
    const fixture = await openAsync(mode, signIn);
    const root: HTMLElement = fixture.nativeElement;
    const section = find(root, "section");
    const organization = find(root, ".nol-git-azure-devops-organization").getBoundingClientRect();
    const token = find(root, ".nol-git-azure-devops-token").getBoundingClientRect();
    const title = find(root, "h3").getBoundingClientRect();

    AppearanceFixture.expectPixels(organization.left, title.left);
    AppearanceFixture.expectPixels(organization.right, contentRight(section));
    AppearanceFixture.expectPixels(organization.height, token.height);
    AppearanceFixture.expectPixels(token.top - organization.bottom, px(0.5625));
  });

  it.each(tokenCases)("titles Sign in with Microsoft under the token page's button, on the title's edge, with its note under it, in %s mode, %s", async (mode, _name, signIn) => {
    const fixture = await openAsync(mode, signIn);
    const root: HTMLElement = fixture.nativeElement;
    const make = find(root, ".nol-git-azure-devops-token-row + p + ul + .nol-git-azure-devops-row").getBoundingClientRect();
    const heading = find(root, "h4");
    const headingBox = heading.getBoundingClientRect();
    const row = find(root, ".nol-git-azure-devops-microsoft-row").getBoundingClientRect();
    const button = find(root, ".nol-git-azure-devops-microsoft-row button").getBoundingClientRect();
    const note = find(root, ".nol-git-azure-devops-microsoft-row + p").getBoundingClientRect();
    const title = find(root, "h3");
    const left = title.getBoundingClientRect().left;

    AppearanceFixture.expectPixels(headingBox.left, left);
    AppearanceFixture.expectPixels(headingBox.top - make.bottom, px(0.75));
    AppearanceFixture.expectPixels(button.left, left);
    AppearanceFixture.expectPixels(row.top - headingBox.bottom, px(0.5625));
    AppearanceFixture.expectPixels(note.left, left);
    AppearanceFixture.expectPixels(note.top - row.bottom, px(0.1875));
    expect([getComputedStyle(heading).fontWeight, getComputedStyle(heading).fontSize, getComputedStyle(heading).color])
      .toEqual([getComputedStyle(title).fontWeight, getComputedStyle(title).fontSize, getComputedStyle(title).color]);
  });

  it.each(tokenCases)("lets nothing in the section overflow the page's width, in %s mode, %s", async (mode, _name, signIn) => {
    const fixture = await openAsync(mode, signIn);
    const root: HTMLElement = fixture.nativeElement;
    const section = find(root, "section");
    const right = contentRight(section);

    expect([section.scrollWidth <= section.clientWidth, find(root, ".column").scrollWidth <= find(root, ".column").clientWidth]).toEqual([true, true]);
    for (const element of section.querySelectorAll<HTMLElement>("input, button, p, [role=alert]"))
      expect(element.getBoundingClientRect().right).toBeLessThanOrEqual(right + 1 / 32);
  });

  it.each(AppearanceFixture.modes)("sets the account's avatar beside its login and name, in %s mode", async mode => {
    const fixture = await openAsync(mode, HostSignIn.signedIn(account));
    const root: HTMLElement = fixture.nativeElement;
    const avatar = find(root, "nol-avatar").getBoundingClientRect();
    const text = find(root, ".nol-git-azure-devops-account-text").getBoundingClientRect();
    const title = find(root, "h3").getBoundingClientRect();

    AppearanceFixture.expectPixels(avatar.left, title.left);
    AppearanceFixture.expectPixels(avatar.width, px(1.75));
    AppearanceFixture.expectPixels(avatar.height, px(1.75));
    AppearanceFixture.expectPixels(text.left - avatar.right, px(0.625));
    AppearanceFixture.expectPixels(avatar.top + avatar.height / 2, text.top + text.height / 2);
  });

  it.each(AppearanceFixture.modes)("frames a sign-in that couldn't be read in a raised banner under the Account title, with Try again on the title's edge, in %s mode", async mode => {
    const fixture = await openAsync(mode, null);
    const root: HTMLElement = fixture.nativeElement;
    const banner = find(root, "[role=alert]");
    const box = banner.getBoundingClientRect();
    const title = find(root, "h3").getBoundingClientRect();
    const section = find(root, "section");
    const retry = find(root, ".nol-git-azure-devops-row button").getBoundingClientRect();

    expectBannerInsets(banner);
    AppearanceFixture.expectPixels(box.left, title.left);
    AppearanceFixture.expectPixels(box.right, contentRight(section));
    AppearanceFixture.expectPixels(box.top - title.bottom, px(0.5625));
    AppearanceFixture.expectPixels(retry.left, title.left);
    AppearanceFixture.expectPixels(retry.top - box.bottom, px(0.5625));
    expect([getComputedStyle(find(root, ".nol-git-azure-devops-banner-icon")).color, getComputedStyle(banner).backgroundColor, getComputedStyle(banner).borderTopStyle])
      .toEqual([tokenColor("--nol-error"), tokenColor("--nol-raised"), "solid"]);

    await page.screenshot({ element: find(root, ".column"), path: `${screenshots}/sign-in-unread-banner-${mode}.png` });
  });

  it.each(AppearanceFixture.modes)("frames a request that failed in a raised banner at the section's end, on the title's edges, a gap under what comes before it, in %s mode", async mode => {
    const fixture = await failSignInAsync(mode);
    const root: HTMLElement = fixture.nativeElement;
    const section = find(root, "section");
    const sectionBox = section.getBoundingClientRect();
    const banner = section.lastElementChild;
    if (!(banner instanceof HTMLElement))
      throw new Error("The section has no last element.");
    const box = banner.getBoundingClientRect();
    const title = find(root, "h3").getBoundingClientRect();
    const above = banner.previousElementSibling;

    expect([banner.getAttribute("role"), find(banner, ".nol-git-azure-devops-strong").textContent?.trim()]).toEqual(["alert", "Azure DevOps' sign-in didn't answer."]);
    expectBannerInsets(banner);
    AppearanceFixture.expectPixels(box.left, title.left);
    AppearanceFixture.expectPixels(box.right, contentRight(section));
    AppearanceFixture.expectPixels(box.top - (above?.getBoundingClientRect().bottom ?? 0), px(0.5625));
    AppearanceFixture.expectPixels(sectionBox.bottom - box.bottom, px(1.125));
    expect(getComputedStyle(find(banner, ".nol-git-azure-devops-banner-icon")).color).toBe(tokenColor("--nol-error"));

    await page.screenshot({ element: find(root, ".column"), path: `${screenshots}/sign-in-request-failed-${mode}.png` });
  });

  it("draws the request-failed banner's border, error mark and text in the system's colours, in forced colours", async () => {
    await emulateForcedColorsAsync("active");
    const fixture = await failSignInAsync(ThemeMode.Light);
    const root: HTMLElement = fixture.nativeElement;
    const banner = find(root, "[role=alert]");

    expect(matchMedia("(forced-colors: active)").matches).toBe(true);
    expect([getComputedStyle(banner).borderTopStyle, getComputedStyle(find(banner, ".nol-git-azure-devops-banner-icon")).color,
      getComputedStyle(find(banner, ".nol-git-azure-devops-strong")).color]).toEqual(["solid", colorOf("CanvasText"), colorOf("CanvasText")]);
    expectBannerInsets(banner);

    await page.screenshot({ element: find(root, ".column"), path: `${screenshots}/sign-in-request-failed-forced.png` });
  });

  it.each(AppearanceFixture.modes)("frames why the sign-in ended in a raised banner with the error mark, in %s mode", async mode => {
    const fixture = await openAsync(mode, HostSignIn.signedOut(SignInFailure.Refused));
    const root: HTMLElement = fixture.nativeElement;
    const banner = find(root, "[role=alert]");
    const style = getComputedStyle(banner);

    expectBannerInsets(banner);
    expect([getComputedStyle(find(root, ".nol-git-azure-devops-banner-icon")).color, style.backgroundColor]).toEqual([tokenColor("--nol-error"), tokenColor("--nol-raised")]);
  });
});
