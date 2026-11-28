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
import { HostAccount, HostAccountEntry, HostAccountList, HostSignIn } from "@noldova/git.hosting.protocol";
import { GitHostAccounts } from "@noldova/git.window";
import { DefaultTheme, ThemeMode } from "@noldova/ui.components.angular";
import { AppearanceFixture } from "@noldova/ui.components.angular/testing";
import { afterEach, describe, expect, it } from "vitest";
import { page } from "vitest/browser";

import { GitHubEnterpriseComponent } from "../../../../src/app/components/github-enterprise/github-enterprise.component.ts";
import { RequestAnswers } from "../../../fixtures/request-answers.fixture.ts";

@Component({
  selector: "nol-git-github-enterprise-body",
  imports: [GitHubEnterpriseComponent],
  template: "<div class=\"body\"><nol-git-github-enterprise /></div>",
  styles: [
    ".body { box-sizing: border-box; width: 32rem; padding: 1rem 1.5rem; background: var(--nol-panel); color: var(--nol-text);"
    + " font-family: var(--nol-font-sans); font-size: var(--nol-text-panel); line-height: var(--nol-line-panel); }"
  ]
})
class DialogBodyComponent {
}

const mona: HostAccountEntry = new HostAccountEntry(2, HostSignIn.signedIn(new HostAccount("monalisa", "Mona", null, ["repo"])), "ghe.example.com");
const screenshots: string = "../../../../../../_build/github-window/screenshots";

async function openAsync(mode: ThemeMode, chosen: string | null): Promise<ComponentFixture<DialogBodyComponent>> {
  AppearanceFixture.apply(DefaultTheme.theme, mode);
  const context = new FakeWindowPartContext();
  new RequestAnswers(context).answer(GitHubNames.readAccountsMethod, new HostAccountList([mona]).toJson());
  TestBed.configureTestingModule({ providers: [{ provide: WindowPartTokens.context, useValue: context }, { provide: GitHostAccounts.chosenAccount, useValue: chosen }] });
  const fixture = TestBed.createComponent(DialogBodyComponent);
  await fixture.whenStable();
  fixture.detectChanges();
  await fixture.whenStable();
  return fixture;
}

function one(root: HTMLElement, selector: string): DOMRect {
  const found = root.querySelector(selector);
  if (!(found instanceof HTMLElement))
    throw new Error(`Nothing matches ${selector}.`);
  return found.getBoundingClientRect();
}

function all(root: HTMLElement, selector: string): DOMRect[] {
  return [...root.querySelectorAll(selector)].filter(t => t instanceof HTMLElement).map(t => t.getBoundingClientRect());
}

describe("GitHubEnterpriseComponent in the kit's look", () => {
  afterEach(() => {
    AppearanceFixture.reset();
  });

  it.each(AppearanceFixture.modes)("lines the title, the notes and both fields up on one start edge, each field growing to its button at the row's end, in %s mode",
    async mode => {
      const fixture = await openAsync(mode, null);
      const root: HTMLElement = fixture.nativeElement;
      const section = one(root, ".nol-git-github-setting");
      const start: number = one(root, ".nol-git-github-setting-title").left;
      const rows = [...root.querySelectorAll(".nol-git-github-field-row")].filter(t => t instanceof HTMLElement);

      expect(rows).toHaveLength(2);
      AppearanceFixture.expectPixels(start - section.left, AppearanceFixture.toPixels(0.875));
      for (const box of [...all(root, ".nol-git-github-field"), ...all(root, ".nol-git-github-setting-note")])
        AppearanceFixture.expectPixels(box.left, start);
      for (const row of rows) {
        const field = one(row, ".nol-git-github-field");
        const button = one(row, "button");
        const box = row.getBoundingClientRect();
        AppearanceFixture.expectPixels(button.right, box.right);
        AppearanceFixture.expectPixels(button.left - field.right, Number.parseFloat(getComputedStyle(row).columnGap));
        AppearanceFixture.expectPixels(field.height, button.height);
        AppearanceFixture.expectPixels(field.top, button.top);
        expect(field.width).toBeGreaterThan(button.width);
      }
      await page.screenshot({ path: `${screenshots}/enterprise-${mode}.png`, element: root.querySelector(".body") ?? root });
    });

  it.each(AppearanceFixture.modes)("shows a connected account with its server under its name, and both actions on the name's start edge, in %s mode", async mode => {
    const fixture = await openAsync(mode, "2");
    const root: HTMLElement = fixture.nativeElement;
    const name = one(root, ".nol-git-github-account-text");
    const actions = all(root, "button");

    expect([...root.querySelectorAll(".nol-git-github-account-text > *")].map(t => t.textContent?.trim())).toEqual(["Mona", "monalisa · ghe.example.com"]);
    AppearanceFixture.expectPixels(actions[0]?.left ?? Number.NaN, one(root, ".nol-git-github-account").left);
    expect(actions.map(t => t.top - (actions[0]?.top ?? 0))).toEqual([0, 0]);
    expect(name.left).toBeGreaterThan(one(root, ".nol-git-github-account").left);
    await page.screenshot({ path: `${screenshots}/enterprise-account-${mode}.png`, element: root.querySelector(".body") ?? root });
  });
});
