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
import { HostPullRequestCommit, HostPullRequestCommits, HostReference } from "@noldova/git.hosting.protocol";
import { DefaultTheme, type ThemeMode } from "@noldova/ui.components.angular";
import { AppearanceFixture } from "@noldova/ui.components.angular/testing";
import { afterEach, describe, expect, it } from "vitest";

import { GitPullRequestCommitsComponent } from "../../../../src/app/components/git-pull-request-commits/git-pull-request-commits.component.ts";
import { RequestAnswers } from "../../../fixtures/request-answers.fixture.ts";
import { TestPullRequestHost } from "../../../fixtures/test-pull-request-host.fixture.ts";

const reference: HostReference = new HostReference("git-example", "fabrikam", "3f2504e0-4f89-11d3-9a0c-0305e82c3301", 482);
const HEAD: string = "9fceb02d0ae598e95dc970b74767f19372d61af8";
const AT: number = Date.UTC(2026, 0, 5, 12);

@Component({
  selector: "nol-git-test-document",
  imports: [GitPullRequestCommitsComponent],
  template: "<div class=\"document\"><nol-git-pull-request-commits [host]=\"host\" [reference]=\"reference\" url=\"https://example.com/fabrikam/site/pulls/482\" /></div>",
  styles: [
    ".document { box-sizing: border-box; width: 30rem; color: var(--nol-text); font-family: var(--nol-font-sans); font-size: var(--nol-text-panel);"
    + " line-height: var(--nol-line-panel); }"
  ]
})
class DocumentComponent {
  protected readonly host: TestPullRequestHost = new TestPullRequestHost();
  protected readonly reference: HostReference = reference;
}

async function openAsync(mode: ThemeMode): Promise<ComponentFixture<DocumentComponent>> {
  AppearanceFixture.apply(DefaultTheme.theme, mode);
  const context = new FakeWindowPartContext();
  const requests = new RequestAnswers(context);
  requests.answer(TestPullRequestHost.commitsMethod, new HostPullRequestCommits([
    new HostPullRequestCommit(HEAD, `Show ${"exported Markdown notes ".repeat(8)}`, "Mona Lisa", AT),
    ...Array.from({ length: 249 }, () => new HostPullRequestCommit(HEAD, "Step", "Hubot", AT))], true).toJson());
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

describe("The pull request's Commits tab in the kit's look", () => {
  afterEach(() => {
    AppearanceFixture.reset();
  });

  it.each(AppearanceFixture.modes)("starts a commit row's id at its inset and ends its byline at the row's end, cutting a long subject between them, in %s mode", async mode => {
    const root: HTMLElement = (await openAsync(mode)).nativeElement;
    const tab = find(root, "nol-git-pull-request-commits");
    const row = find(tab, ".row");
    const box = row.getBoundingClientRect();
    const sha = find(row, ".sha").getBoundingClientRect();
    const subject = find(row, ".subject");
    const byline = find(row, ".byline").getBoundingClientRect();
    const cap = find(tab, ".cap").getBoundingClientRect();

    AppearanceFixture.expectPixels(box.width, tab.getBoundingClientRect().width);
    AppearanceFixture.expectPixels(sha.left - box.left, px(0.25));
    AppearanceFixture.expectPixels(subject.getBoundingClientRect().left - sha.right, px(0.5));
    AppearanceFixture.expectPixels(byline.left - subject.getBoundingClientRect().right, px(0.5));
    AppearanceFixture.expectPixels(box.right - byline.right, px(0.25));
    expect(subject.scrollWidth).toBeGreaterThan(subject.clientWidth);
    AppearanceFixture.expectPixels(cap.left + px(0.25), sha.left);
  });

});
