/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type {} from "@vitest/browser-playwright";
import { Component, inject } from "@angular/core";
import { type ComponentFixture, TestBed } from "@angular/core/testing";
import { WindowPartTokens } from "@noldova/desktop.window";
import { FakeWindowPartContext } from "@noldova/desktop.window/testing";
import { AzureDevOpsNames } from "@noldova/git.azure-devops.protocol";
import { HostPullRequestCommit, HostPullRequestCommits, HostPullRequestUpdate, HostPullRequestUpdates, HostReference } from "@noldova/git.hosting.protocol";
import { GitPullRequestCommitsComponent } from "@noldova/git.window";
import { DefaultTheme, type ThemeMode } from "@noldova/ui.components.angular";
import { AppearanceFixture } from "@noldova/ui.components.angular/testing";
import { afterEach, describe, it } from "vitest";

import { AzureDevOpsPullRequestUpdatesComponent } from "../../../../src/app/components/azure-devops-pull-request-updates/azure-devops-pull-request-updates.component.ts";
import { AzureDevOpsPullRequestHost } from "../../../../src/app/services/azure-devops-pull-request-host.ts";
import { RequestAnswers } from "../../../fixtures/request-answers.fixture.ts";

const reference: HostReference = new HostReference("git-azure-devops", "fabrikam", "3f2504e0-4f89-11d3-9a0c-0305e82c3301", 482);
const HEAD: string = "9fceb02d0ae598e95dc970b74767f19372d61af8";
const AT: number = Date.UTC(2026, 0, 5, 12);

@Component({
  selector: "nol-git-azure-devops-document",
  imports: [AzureDevOpsPullRequestUpdatesComponent, GitPullRequestCommitsComponent],
  template: "<div class=\"document\"><nol-git-pull-request-commits [host]=\"host\" [reference]=\"reference\" url=\"https://dev.azure.com/fabrikam/web/_git/site/pullrequest/482\" />"
    + "<nol-git-azure-devops-pull-request-updates [reference]=\"reference\" url=\"https://dev.azure.com/fabrikam/web/_git/site/pullrequest/482\" /></div>",
  styles: [
    ".document { box-sizing: border-box; width: 30rem; color: var(--nol-text); font-family: var(--nol-font-sans); font-size: var(--nol-text-panel);"
    + " line-height: var(--nol-line-panel); }"
  ]
})
class DocumentComponent {
  protected readonly host: AzureDevOpsPullRequestHost = new AzureDevOpsPullRequestHost(inject(WindowPartTokens.context));
  protected readonly reference: HostReference = reference;
}

async function openAsync(mode: ThemeMode): Promise<ComponentFixture<DocumentComponent>> {
  AppearanceFixture.apply(DefaultTheme.theme, mode);
  const context = new FakeWindowPartContext();
  const requests = new RequestAnswers(context);
  requests.answer(AzureDevOpsNames.readPullRequestCommitsMethod, new HostPullRequestCommits([
    new HostPullRequestCommit(HEAD, `Show ${"exported Markdown notes ".repeat(8)}`, "Mona Lisa", AT),
    ...Array.from({ length: 249 }, () => new HostPullRequestCommit(HEAD, "Step", "Hubot", AT))], true).toJson());
  requests.answer(AzureDevOpsNames.readPullRequestUpdatesMethod, new HostPullRequestUpdates([
    new HostPullRequestUpdate(2, null, AT, HEAD, null)], false).toJson());
  TestBed.configureTestingModule({ providers: [{ provide: WindowPartTokens.context, useValue: context }] });
  const fixture = TestBed.createComponent(DocumentComponent);
  fixture.autoDetectChanges();
  await fixture.whenStable();
  fixture.detectChanges();
  await fixture.whenStable();
  return fixture;
}

function find(root: Element, selector: string): HTMLElement {
  const found = root.querySelector(selector);
  if (!(found instanceof HTMLElement))
    throw new Error(`Nothing matches ${selector}.`);
  return found;
}

function px(rem: number): number {
  return AppearanceFixture.toPixels(rem);
}

describe("The pull request's Updates tab in the kit's look", () => {
  afterEach(() => {
    AppearanceFixture.reset();
  });

  it.each(AppearanceFixture.modes)("lays an update row out as a commit row: its number at the inset and its head commit at the row's end, in %s mode", async mode => {
    const root: HTMLElement = (await openAsync(mode)).nativeElement;
    const commit = find(find(root, "nol-git-pull-request-commits"), ".row").getBoundingClientRect();
    const row = find(find(root, "nol-git-azure-devops-pull-request-updates"), ".row");
    const box = row.getBoundingClientRect();
    const number = find(row, ".number").getBoundingClientRect();
    const sha = find(row, ".sha").getBoundingClientRect();

    AppearanceFixture.expectPixels(box.height, commit.height);
    AppearanceFixture.expectPixels(number.left - box.left, px(0.25));
    AppearanceFixture.expectPixels(box.right - sha.right, px(0.25));
  });
});
