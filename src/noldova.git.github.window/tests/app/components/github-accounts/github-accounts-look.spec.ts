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
import { DefaultTheme, ThemeMode } from "@noldova/ui.components.angular";
import { AppearanceFixture } from "@noldova/ui.components.angular/testing";
import { afterEach, describe, expect, it } from "vitest";
import { page } from "vitest/browser";

import { GitHubAccountsComponent } from "../../../../src/app/components/github-accounts/github-accounts.component.ts";
import { RequestAnswers } from "../../../fixtures/request-answers.fixture.ts";

@Component({
  selector: "nol-git-github-dialog-body",
  imports: [GitHubAccountsComponent],
  template: "<div class=\"body\"><nol-git-github-accounts /></div>",
  styles: [
    ".body { box-sizing: border-box; width: 32rem; padding: 1rem 1.5rem; background: var(--nol-panel); color: var(--nol-text);"
    + " font-family: var(--nol-font-sans); font-size: var(--nol-text-panel); line-height: var(--nol-line-panel); }"
  ]
})
class DialogBodyComponent {
}

const kim: HostSignIn = HostSignIn.signedIn(new HostAccount("kim", null, null, ["repo"]));
const lee: HostSignIn = HostSignIn.signedIn(new HostAccount("lee", null, null, []));
const screenshots: string = "../../../../../../_build/github-window/screenshots";

async function openAsync(mode: ThemeMode): Promise<ComponentFixture<DialogBodyComponent>> {
  AppearanceFixture.apply(DefaultTheme.theme, mode);
  const context = new FakeWindowPartContext();
  const requests = new RequestAnswers(context);
  requests.answer(GitHubNames.readAccountsMethod, new HostAccountList([new HostAccountEntry(1, kim), new HostAccountEntry(2, lee)]).toJson());
  requests.answer(GitHubNames.readSignInMethod, kim.toJson(), lee.toJson());
  TestBed.configureTestingModule({ providers: [{ provide: WindowPartTokens.context, useValue: context }] });
  const fixture = TestBed.createComponent(DialogBodyComponent);
  await fixture.whenStable();
  fixture.detectChanges();
  await fixture.whenStable();
  return fixture;
}

function all(root: HTMLElement, selector: string): HTMLElement[] {
  return [...root.querySelectorAll(selector)].filter(t => t instanceof HTMLElement);
}

describe("GitHubAccountsComponent in the kit's look", () => {
  afterEach(() => {
    AppearanceFixture.reset();
  });

  it.each(AppearanceFixture.modes)("stacks each account's section and the Add row edge to edge, on one start edge, in %s mode", async mode => {
    const fixture = await openAsync(mode);
    const root: HTMLElement = fixture.nativeElement;
    const sections = all(root, ".nol-git-github-setting");
    const start: number = all(root, ".nol-git-github-account")[0]?.getBoundingClientRect().left ?? Number.NaN;
    const boxes = sections.map(t => t.getBoundingClientRect());

    expect([all(root, ".nol-git-github-setting-title").map(t => t.textContent?.trim()), all(root, "button .nol-button-label").map(t => t.textContent?.trim())])
      .toEqual([["kim", "lee"], ["Sign out", "Manage access on GitHub", "Sign out", "Manage access on GitHub", "Add another GitHub account"]]);
    for (const section of sections) {
      AppearanceFixture.expectPixels(section.querySelector("button")?.getBoundingClientRect().left ?? Number.NaN, start);
      AppearanceFixture.expectPixels(start - section.getBoundingClientRect().left, AppearanceFixture.toPixels(0.875));
    }
    for (const [index, box] of boxes.entries())
      AppearanceFixture.expectPixels(box.top, boxes[index - 1]?.bottom ?? box.top);
    await page.screenshot({ path: `${screenshots}/accounts-${mode}.png`, element: root.querySelector(".body") ?? root });
  });
});
