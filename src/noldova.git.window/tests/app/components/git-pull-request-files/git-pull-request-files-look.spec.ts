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
import { FileChangeKind, HostChanges, HostPullRequestConflicts, HostPullRequestFile, HostPullRequestFiles, HostReference } from "@noldova/git.hosting.protocol";
import { DefaultTheme, type ThemeMode } from "@noldova/ui.components.angular";
import { AppearanceFixture } from "@noldova/ui.components.angular/testing";
import { afterEach, describe, expect, it } from "vitest";

import { GitPullRequestConflictsComponent } from "../../../../src/app/components/git-pull-request-conflicts/git-pull-request-conflicts.component.ts";
import { GitPullRequestFilesComponent } from "../../../../src/app/components/git-pull-request-files/git-pull-request-files.component.ts";
import { RequestAnswers } from "../../../fixtures/request-answers.fixture.ts";
import { TestPullRequestHost } from "../../../fixtures/test-pull-request-host.fixture.ts";

const reference: HostReference = new HostReference("git-example", "fabrikam", "3f2504e0-4f89-11d3-9a0c-0305e82c3301", 752);
const HEAD: string = "9fceb02d0ae598e95dc970b74767f19372d61af8";
const LONG: string = `src/${"markdown-note-exports/".repeat(8)}timeline.ts`;

@Component({
  selector: "nol-git-test-document",
  imports: [GitPullRequestConflictsComponent, GitPullRequestFilesComponent],
  template: "<div class=\"document\"><nol-git-pull-request-files [host]=\"host\" [reference]=\"reference\" url=\"https://example.com/fabrikam/site/pulls/752\" />"
    + "<nol-git-pull-request-conflicts [host]=\"host\" [reference]=\"reference\" url=\"https://example.com/fabrikam/site/pulls/752\" [changes]=\"changes\" /></div>",
  styles: [
    ".document { box-sizing: border-box; width: 30rem; color: var(--nol-text); font-family: var(--nol-font-sans); font-size: var(--nol-text-panel);"
    + " line-height: var(--nol-line-panel); }"
  ]
})
class DocumentComponent {
  protected readonly host: TestPullRequestHost = new TestPullRequestHost();
  protected readonly reference: HostReference = reference;
  protected readonly changes: HostChanges = new HostChanges(null, null, null, "feature/export-notes", "main", HEAD);
}

async function openAsync(mode: ThemeMode): Promise<ComponentFixture<DocumentComponent>> {
  AppearanceFixture.apply(DefaultTheme.theme, mode);
  const context = new FakeWindowPartContext();
  const requests = new RequestAnswers(context);
  requests.answer(TestPullRequestHost.changesMethod, new HostPullRequestFiles(HEAD, null, [
    new HostPullRequestFile(LONG, FileChangeKind.Modified, null), new HostPullRequestFile("docs/guide.md", FileChangeKind.Renamed, "guide.md"),
    ...Array.from({ length: 998 }, (_, i) => new HostPullRequestFile(`f${String(i)}.ts`, FileChangeKind.Added, null))], true).toJson());
  requests.answer(TestPullRequestHost.conflictsMethod, new HostPullRequestConflicts([LONG, "README.md"], false).toJson());
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

describe("The pull request's Files and Conflicts tabs in the kit's look", () => {
  afterEach(() => {
    AppearanceFixture.reset();
  });

  it.each(AppearanceFixture.modes)("starts a file row's letter at its inset with the hint and the cap, and cuts a long path at the row's end, in %s mode", async mode => {
    const root: HTMLElement = (await openAsync(mode)).nativeElement;
    const tab = find(root, "nol-git-pull-request-files");
    const row = find(tab, ".row");
    const box = row.getBoundingClientRect();
    const letter = find(row, ".letter").getBoundingClientRect();
    const path = find(row, ".path");
    const hint = find(tab, ".hint-text").getBoundingClientRect();
    const cap = find(tab, ".cap").getBoundingClientRect();

    AppearanceFixture.expectPixels(box.width, tab.getBoundingClientRect().width);
    AppearanceFixture.expectPixels(letter.left - box.left, px(0.25));
    AppearanceFixture.expectPixels(path.getBoundingClientRect().left - letter.right, px(0.5));
    AppearanceFixture.expectPixels(box.right - path.getBoundingClientRect().right, px(0.25));
    expect(path.scrollWidth).toBeGreaterThan(path.clientWidth);
    AppearanceFixture.expectPixels(hint.left, letter.left);
    AppearanceFixture.expectPixels(cap.left + px(0.25), letter.left);
  });

  it.each(AppearanceFixture.modes)("lays a conflict row out as a file row: its icon at the inset and a long path cut at the row's end, in %s mode", async mode => {
    const root: HTMLElement = (await openAsync(mode)).nativeElement;
    const file = find(find(root, "nol-git-pull-request-files"), ".row").getBoundingClientRect();
    const tab = find(root, "nol-git-pull-request-conflicts");
    const row = find(tab, ".row");
    const box = row.getBoundingClientRect();
    const icon = find(row, ".icon").getBoundingClientRect();
    const path = find(row, ".path");

    AppearanceFixture.expectPixels(box.height, file.height);
    AppearanceFixture.expectPixels(box.width, tab.getBoundingClientRect().width);
    AppearanceFixture.expectPixels(icon.left - box.left, px(0.25));
    AppearanceFixture.expectPixels(path.getBoundingClientRect().left - icon.right, px(0.5));
    AppearanceFixture.expectPixels(box.right - path.getBoundingClientRect().right, px(0.25));
    expect(path.scrollWidth).toBeGreaterThan(path.clientWidth);
  });
});
