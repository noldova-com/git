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
import { HostAccount, HostAccountEntry, HostAccountList, HostSignIn } from "@noldova/git.hosting.protocol";
import { DefaultTheme, ThemeMode } from "@noldova/ui.components.angular";
import { AppearanceFixture } from "@noldova/ui.components.angular/testing";
import { afterEach, describe, expect, it } from "vitest";
import { page } from "vitest/browser";

import { RightEdge } from "../../../../../noldova.git.window/tests/fixtures/right-edge.fixture.ts";
import { AzureDevOpsAccountsComponent } from "../../../../src/app/components/azure-devops-accounts/azure-devops-accounts.component.ts";
import { RequestAnswers } from "../../../fixtures/request-answers.fixture.ts";

@Component({
  selector: "nol-git-azure-devops-dialog-body",
  imports: [AzureDevOpsAccountsComponent],
  template: "<div class=\"body\"><nol-git-azure-devops-accounts /></div>",
  styles: [
    ".body { box-sizing: border-box; width: 32rem; padding: 1rem 1.5rem; background: var(--nol-panel); color: var(--nol-text);"
    + " font-family: var(--nol-font-sans); font-size: var(--nol-text-panel); line-height: var(--nol-line-panel); }"
  ]
})
class DialogBodyComponent {
}

const kim: HostSignIn = HostSignIn.signedIn(new HostAccount("kim@example.com", null, null, []));
const lee: HostSignIn = HostSignIn.signedIn(new HostAccount("lee@example.com", "Lee", null, []));
const screenshots: string = "../../../../../../_build/azure-devops-window/screenshots";
const cases = AppearanceFixture.modes.flatMap(mode => [[mode, false], [mode, true]] as const);

async function settleAsync(fixture: ComponentFixture<DialogBodyComponent>): Promise<void> {
  await fixture.whenStable();
  fixture.detectChanges();
  await fixture.whenStable();
}

async function openAsync(mode: ThemeMode, isAdding: boolean): Promise<ComponentFixture<DialogBodyComponent>> {
  AppearanceFixture.apply(DefaultTheme.theme, mode);
  const context = new FakeWindowPartContext();
  const requests = new RequestAnswers(context);
  requests.answer(AzureDevOpsNames.readAccountsMethod, new HostAccountList([new HostAccountEntry(1, kim, "dev.azure.com/fabrikam"),
    new HostAccountEntry(2, lee, "dev.azure.com/contoso")]).toJson());
  requests.answer(AzureDevOpsNames.readSignInMethod, kim.toJson(), lee.toJson());
  TestBed.configureTestingModule({ providers: [{ provide: WindowPartTokens.context, useValue: context }] });
  const fixture = TestBed.createComponent(DialogBodyComponent);
  await settleAsync(fixture);
  if (isAdding) {
    const add = all(fixture.nativeElement, "button").find(t => (t.textContent ?? "").includes("Add another Azure DevOps account"));
    add?.click();
    await settleAsync(fixture);
  }
  return fixture;
}

function all(root: HTMLElement, selector: string): HTMLElement[] {
  return [...root.querySelectorAll(selector)].filter(t => t instanceof HTMLElement);
}

describe("AzureDevOpsAccountsComponent in the kit's look", () => {
  afterEach(() => {
    AppearanceFixture.reset();
  });

  it.each(cases)("stacks each account's section and the Add row or the add's form edge to edge, on one start edge and one right content edge, in %s mode, adding: %s",
    async (mode, isAdding) => {
      const fixture = await openAsync(mode, isAdding);
      const root: HTMLElement = fixture.nativeElement;
      const sections = all(root, ".nol-git-azure-devops-setting");
      const start: number = all(root, ".nol-git-azure-devops-account")[0]?.getBoundingClientRect().left ?? Number.NaN;
      const boxes = sections.map(t => t.getBoundingClientRect());

      expect(all(root, ".nol-git-azure-devops-setting-title").map(t => t.textContent?.trim()))
        .toEqual(isAdding ? ["Account", "Account", "Another account", "Or sign in with Microsoft"] : ["Account", "Account"]);
      expect(all(root, "button .nol-button-label").map(t => t.textContent?.trim())).toEqual(isAdding
        ? ["Sign out", "Sign out", "Sign in", "Make a token on Azure DevOps", "Sign in with Microsoft", "Cancel"]
        : ["Sign out", "Sign out", "Add another Azure DevOps account"]);
      for (const section of sections) {
        AppearanceFixture.expectPixels(section.querySelector("button, input")?.getBoundingClientRect().left ?? Number.NaN, start);
        AppearanceFixture.expectPixels(start - section.getBoundingClientRect().left, AppearanceFixture.toPixels(0.875));
      }
      for (const [index, box] of boxes.entries())
        AppearanceFixture.expectPixels(box.top, boxes[index - 1]?.bottom ?? box.top);
      const body: HTMLElement = root.querySelector<HTMLElement>(".body") ?? root;
      const inset: number = start - body.getBoundingClientRect().left - Number.parseFloat(getComputedStyle(body).paddingLeft);
      for (const section of sections)
        AppearanceFixture.expectPixels(RightEdge.contentOf(section), RightEdge.contentOf(body) - inset);
      await page.screenshot({ path: `${screenshots}/accounts-${isAdding ? "adding" : "list"}-${mode}.png`, element: root.querySelector(".body") ?? root });
    });
});
