/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Component, signal } from "@angular/core";
import { type ComponentFixture, TestBed } from "@angular/core/testing";
import { FakeWindowPartContext } from "@noldova/desktop.window/testing";
import type {} from "@vitest/browser-playwright";
import { DefaultTheme } from "@noldova/ui.components.angular";
import { AppearanceFixture } from "@noldova/ui.components.angular/testing";
import { afterEach, describe, expect, it, onTestFinished } from "vitest";
import { page } from "vitest/browser";

import { GitAccountsComponent } from "../../../../src/app/components/git-accounts/git-accounts.component.ts";
import { GitHostCardState } from "../../../../src/app/enums/git-host-card-state.ts";
import { GitHostFeature } from "../../../../src/app/enums/git-host-feature.ts";
import { GitHostCard } from "../../../../src/app/models/git-host-card.ts";
import { GitHostAccounts } from "../../../../src/app/services/git-host-accounts.ts";
import { GitLayout } from "../../../fixtures/git-layout.fixture.ts";

@Component({ selector: "nol-git-test-sign-in", template: "" })
class TestSignInComponent {
}

describe("GitAccountsComponent in the kit's look", () => {
  const screenshots: string = "../../../../../../_build/window/screenshots";
  const rem = (pixels: number): number => Math.round(pixels / parseFloat(getComputedStyle(document.documentElement).fontSize) * 1000) / 1000;
  const box = (element: Element | null): DOMRect => element?.getBoundingClientRect() ?? new DOMRect();

  const resolve = (color: string): string => {
    const probe: HTMLSpanElement = document.createElement("span");
    probe.style.color = color;
    document.body.append(probe);
    const resolved: string = getComputedStyle(probe).color;
    probe.remove();
    return resolved;
  };

  async function renderAsync(width: string): Promise<HTMLElement> {
    const context: FakeWindowPartContext = new FakeWindowPartContext();
    onTestFinished(GitHostAccounts.provide(context, {
      id: "git-github.account", host: "GitHub", column: "GitHub", mark: "GH", markColor: "#24292f", signIn: TestSignInComponent,
      cards: signal([new GitHostCard("GitHub · example-user", "Signed in on this computer · access to your repositories", GitHostCardState.SignedIn, "Signed in")]),
      features: [GitHostFeature.PullRequests, GitHostFeature.BuildsOnCommits]
    }));
    onTestFinished(GitHostAccounts.provide(context, {
      id: "git-azure-devops.account", host: "Azure DevOps", column: "Azure", mark: "Az", markColor: "#0067b8", signIn: TestSignInComponent,
      cards: signal([new GitHostCard("Azure DevOps", "Sign in to see pull requests, builds and work items.", GitHostCardState.SignedOut, "Sign in")]),
      features: [GitHostFeature.PullRequests, GitHostFeature.VotesAndPolicies, GitHostFeature.BuildsOnCommits, GitHostFeature.WorkItems]
    }));
    const fixture: ComponentFixture<GitAccountsComponent> = TestBed.createComponent(GitAccountsComponent);
    const element: HTMLElement = fixture.nativeElement;
    element.style.width = width;
    await fixture.whenStable();
    return element;
  }

  afterEach(async () => {
    try {
      (await AppearanceFixture.parkPointerAsync()).remove();
    }
    finally {
      AppearanceFixture.reset();
    }
  });

  it.each(AppearanceFixture.modes)("sets the cards beside what each host can do on a wide page, in the kit's sizes and colours, in %s mode", async mode => {
    AppearanceFixture.apply(DefaultTheme.theme, mode);
    const element: HTMLElement = await renderAsync("60rem");

    const frame: DOMRect = box(element);
    const accounts: DOMRect = box(element.querySelector(".accounts"));
    const features: DOMRect = box(element.querySelector(".features"));
    const cards: HTMLElement[] = [...element.querySelectorAll<HTMLElement>(".card")];
    const card: HTMLElement = cards[0] ?? element;
    const cardBox: DOMRect = box(card);
    const mark: HTMLElement = card.querySelector<HTMLElement>(".mark") ?? element;
    const markBox: DOMRect = box(mark);
    const text: DOMRect = box(card.querySelector(".text"));
    const end: DOMRect = box(card.querySelector(".end"));
    const rows: DOMRect[] = [...element.querySelectorAll("[role=row]")].map(t => box(t));
    const cells: DOMRect[] = [...element.querySelectorAll("[role=row]:nth-child(2) > *")].map(t => box(t));
    const yes: Element | null = element.querySelector(".answer.yes");
    const no: Element | null = element.querySelector(".answer:not(.yes)");
    const style: CSSStyleDeclaration = getComputedStyle(card);

    expect([rem(accounts.left - frame.left), rem(features.width), rem(features.left - accounts.right), rem(frame.right - features.right)]).toEqual([0, 26, 1, 0]);
    expect([rem(markBox.left - cardBox.left - card.clientLeft), rem((markBox.top + markBox.bottom - cardBox.top - cardBox.bottom) / 2), rem(markBox.width), rem(markBox.height)])
      .toEqual([0.75, 0, 2, 2]);
    expect([rem(text.left - markBox.right), rem(cardBox.right - card.clientLeft - end.right), rem(text.top - cardBox.top - card.clientTop),
      rem(cardBox.bottom - card.clientTop - text.bottom)]).toEqual([0.75, 0.75, 0.75, 0.75]);
    expect(cards.slice(1).map((t, i) => rem(box(t).top - box(cards[i] ?? t).bottom))).toEqual([0.75]);
    expect([style.borderTopLeftRadius, style.borderTopColor, style.backgroundColor]).toEqual(["8px", resolve("var(--nol-card-border)"), resolve("var(--nol-panel)")]);
    expect([getComputedStyle(mark).borderTopLeftRadius, getComputedStyle(mark).color, getComputedStyle(mark).backgroundColor])
      .toEqual(["6px", resolve("var(--nol-button-text)"), "rgb(36, 41, 47)"]);
    expect([getComputedStyle(card.querySelector(".card-title") ?? card).fontSize, getComputedStyle(card.querySelector(".detail") ?? card).fontSize,
      getComputedStyle(element.querySelector("h2") ?? card).fontSize]).toEqual(["13px", "12px", "15px"]);
    const rowBorder: number = parseFloat(getComputedStyle(element.querySelector("[role=row]") ?? card).borderBottomWidth);
    expect([rowBorder, ...rows.map(t => rem(t.height - rowBorder))]).toEqual([1, ...rows.map(() => 1.625)]);
    expect(cells.slice(1).map(t => rem(t.width))).toEqual([4.75, 4.75]);
    expect([rem(features.right - (cells[2]?.right ?? 0)), getComputedStyle(element.querySelector("[role=row]") ?? card).fontSize]).toEqual([0, "10px"]);
    expect([getComputedStyle(yes ?? card).color, getComputedStyle(no ?? card).color]).toEqual([resolve("var(--nol-status-ok)"), resolve("var(--nol-text-muted)")]);
    expect(box(element.querySelector(".answer-text")).width).toBeLessThanOrEqual(1);

    await page.screenshot({ element, path: `${screenshots}/git-accounts-${mode}.png` });
  });

  it.each(AppearanceFixture.modes)("stacks what each host can do under the cards on a narrow page, in %s mode", async mode => {
    AppearanceFixture.apply(DefaultTheme.theme, mode);
    const element: HTMLElement = await renderAsync("30rem");

    const frame: DOMRect = box(element);
    const accounts: DOMRect = box(element.querySelector(".accounts"));
    const features: DOMRect = box(element.querySelector(".features"));

    expect([rem(accounts.width), rem(features.width), rem(features.top - accounts.bottom), rem(features.left - frame.left)]).toEqual([30, 30, 1, 0]);

    await page.screenshot({ element, path: `${screenshots}/git-accounts-narrow-${mode}.png` });
  });

  it.each(AppearanceFixture.modes)("fits the app's narrowest window, 640 by 480 less the title bar and margins, with nothing clipped, outside it or overlapping, in %s mode", async mode => {
    AppearanceFixture.apply(DefaultTheme.theme, mode);
    const element: HTMLElement = await renderAsync("39.5rem");
    element.style.height = "27rem";

    await page.screenshot({ element, path: `${screenshots}/git-accounts-narrowest-${mode}.png` });
    expect(GitLayout.problemsOf(element)).toEqual([]);
  });
});
