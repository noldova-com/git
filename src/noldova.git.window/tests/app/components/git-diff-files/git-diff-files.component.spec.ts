/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { signal, type WritableSignal } from "@angular/core";
import { type ComponentFixture, TestBed } from "@angular/core/testing";
import "@noldova/context.core";
import type { JsonValue } from "@noldova/context.json";
import { WindowPartTokens } from "@noldova/desktop.window";
import { FakeWindowPartContext } from "@noldova/desktop.window/testing";
import { DiffFile, DiffHunk, DiffLine, DiffScope, DiffScopeKind, DiffTotals, FileChange, GitDiff, GitDiffParams, LineKind } from "@noldova/git.protocol";
import { afterEach, describe, expect, it, vi } from "vitest";

import { GitDiffFilesComponent } from "../../../../src/app/components/git-diff-files/git-diff-files.component.ts";
import { GitFileLayout } from "../../../../src/app/enums/git-file-layout.ts";
import { FixtureLine, GitFixtures } from "../../../fixtures/git-fixtures.fixture.ts";
import { Wait } from "../../../fixtures/wait.fixture.ts";

/** The rendered files, with the answers still to give the diff reads. */
class OpenedFiles {
  public readonly fixture: ComponentFixture<GitDiffFilesComponent>;
  public readonly answers: (() => Promise<JsonValue>)[];

  public constructor(fixture: ComponentFixture<GitDiffFilesComponent>, answers: (() => Promise<JsonValue>)[]) {
    this.fixture = fixture;
    this.answers = answers;
  }
}

describe("GitDiffFilesComponent outside the Git view", () => {
  it("reads the scope's diff from the repository and lists its files in folders, with no layout button to switch", async () => {
    const context = new FakeWindowPartContext();
    const scope = new DiffScope(DiffScopeKind.Range, "0".repeat(40), "9".repeat(40));
    context.answer("requestAsync", async () => GitFixtures.diff("src/a.ts", new FixtureLine(LineKind.Added, "one")).toJson());
    TestBed.configureTestingModule({ providers: [{ provide: WindowPartTokens.context, useValue: context }] });
    const fixture = TestBed.createComponent(GitDiffFilesComponent);
    fixture.componentRef.setInput("folder", GitFixtures.folder);
    fixture.componentRef.setInput("scope", scope);
    fixture.autoDetectChanges();
    const element: HTMLElement = fixture.nativeElement;
    await new Promise<void>(resolve => {
      const observer: MutationObserver = new MutationObserver(() => {
        if (!Object.isNull(element.querySelector(".file-row"))) {
          observer.disconnect();
          resolve();
        }
      });
      observer.observe(element, { childList: true, subtree: true });
    });

    expect(context.callsOf("requestAsync")).toEqual([["git.diff", new GitDiffParams(GitFixtures.folder, scope).toJson()]]);
    expect([...element.querySelectorAll(".file-row")].map(t => [t.classList.contains("folder"), t.getAttribute("title")])).toEqual([[true, "src"], [false, "src/a.ts"]]);
    expect(element.querySelector("nol-git-file-layout-button")).toBeNull();
  });

  it("follows a layout it is given, such as a pull request page's own, with the layout button that sets it", async () => {
    const context = new FakeWindowPartContext();
    const layout: WritableSignal<GitFileLayout> = signal(GitFileLayout.List);
    context.answer("requestAsync", async () => GitFixtures.diff("src/a.ts", new FixtureLine(LineKind.Added, "one")).toJson());
    TestBed.configureTestingModule({ providers: [{ provide: WindowPartTokens.context, useValue: context }] });
    const fixture = TestBed.createComponent(GitDiffFilesComponent);
    fixture.componentRef.setInput("folder", GitFixtures.folder);
    fixture.componentRef.setInput("scope", new DiffScope(DiffScopeKind.Range, "0".repeat(40), "9".repeat(40)));
    fixture.componentRef.setInput("layout", layout);
    fixture.autoDetectChanges();
    const element: HTMLElement = fixture.nativeElement;
    await Wait.until(() => !Object.isNull(element.querySelector(".file-row")));
    const listed = [...element.querySelectorAll(".file-row")].map(t => t.getAttribute("title"));
    layout.set(GitFileLayout.Folders);
    await fixture.whenStable();

    expect([listed, [...element.querySelectorAll(".file-row")].map(t => t.getAttribute("title")), !Object.isNull(element.querySelector("nol-git-file-layout-button"))])
      .toEqual([["src/a.ts"], ["src", "src/a.ts"], true]);
  });

  it("heads a diff its budget cut with the whole diff's files and lines, and one it read whole with its own files'", async () => {
    const context = new FakeWindowPartContext();
    const shown: GitDiff = GitFixtures.diff("src/a.ts", new FixtureLine(LineKind.Added, "one"), new FixtureLine(LineKind.Removed, "two"));
    const diffs: GitDiff[] = [new GitDiff(shown.files, shown.totalBytes, 2389, true, new DiffTotals(2391, 14214, 13074)), shown];
    context.answer("requestAsync", async () => diffs.shift()?.toJson() ?? null);
    TestBed.configureTestingModule({ providers: [{ provide: WindowPartTokens.context, useValue: context }] });
    const fixture = TestBed.createComponent(GitDiffFilesComponent);
    fixture.componentRef.setInput("folder", GitFixtures.folder);
    fixture.componentRef.setInput("scope", new DiffScope(DiffScopeKind.Range, "0".repeat(40), "9".repeat(40)));
    fixture.autoDetectChanges();
    const element: HTMLElement = fixture.nativeElement;
    const header = (): string[] => [...element.querySelectorAll(".files-header > span")].map(t => t.textContent.trim());
    await Wait.until(() => !Object.isNull(element.querySelector(".file-row")));
    const cut: string[] = header();
    fixture.componentRef.setInput("scope", new DiffScope(DiffScopeKind.Range, "1".repeat(40), "9".repeat(40)));
    await Wait.until(() => diffs.length === 0 && !Object.isNull(element.querySelector(".file-row")));

    expect([cut, header()]).toEqual([["2391 files changed", "+14214", "−13074"], ["1 file changed", "+1", "−1"]]);
  });

  it("says a renamed file came from its old file name, its row's title holding the whole old path", async () => {
    const context = new FakeWindowPartContext();
    const renamed = new DiffFile("src/log-fixture.ts", undefined, "tests/old/log.fixture.ts", undefined, FileChange.Renamed, null, null, false, null, [], false);
    context.answer("requestAsync", async () => new GitDiff([renamed], 0, 0, false).toJson());
    TestBed.configureTestingModule({ providers: [{ provide: WindowPartTokens.context, useValue: context }] });
    const fixture = TestBed.createComponent(GitDiffFilesComponent);
    fixture.componentRef.setInput("folder", GitFixtures.folder);
    fixture.componentRef.setInput("scope", new DiffScope(DiffScopeKind.Range, "0".repeat(40), "9".repeat(40)));
    fixture.autoDetectChanges();
    const element: HTMLElement = fixture.nativeElement;
    await Wait.until(() => !Object.isNull(element.querySelector(".file-row:not(.folder)")));
    const row: Element | null = element.querySelector(".file-row:not(.folder)");

    expect([row?.querySelector(".grow")?.textContent, row?.getAttribute("title")])
      .toEqual(["log-fixture.ts from log.fixture.ts", "src/log-fixture.ts from tests/old/log.fixture.ts"]);
  });

  describe("revealing a line", () => {
    /** Two hunks of `src/app.ts`: new lines 3 and 4, the second removed, then new lines 20 to 22, with 21 added. */
    const twoHunks: GitDiff = new GitDiff([new DiffFile("src/app.ts", undefined, "src/app.ts", undefined, FileChange.Modified, null, null, false, null, [
      new DiffHunk(3, 2, 3, 1, "", [new DiffLine(LineKind.Context, 3, 3, "one"), new DiffLine(LineKind.Removed, 4, null, "gone")]),
      new DiffHunk(19, 2, 20, 3, "", [new DiffLine(LineKind.Context, 19, 20, "two"), new DiffLine(LineKind.Added, null, 21, "three"),
        new DiffLine(LineKind.Context, 20, 22, "four")])
    ], false)], 0, 0, false);

    afterEach(() => {
      vi.restoreAllMocks();
    });

    async function openAsync(): Promise<OpenedFiles> {
      const context = new FakeWindowPartContext();
      const answers: (() => Promise<JsonValue>)[] = [async () => twoHunks.toJson(), async () => twoHunks.toJson()];
      context.answer("requestAsync", async () => answers.shift()?.() ?? null);
      TestBed.configureTestingModule({ providers: [{ provide: WindowPartTokens.context, useValue: context }] });
      const fixture = TestBed.createComponent(GitDiffFilesComponent);
      fixture.componentRef.setInput("folder", GitFixtures.folder);
      fixture.componentRef.setInput("scope", new DiffScope(DiffScopeKind.Range, "0".repeat(40), "9".repeat(40)));
      fixture.autoDetectChanges();
      await Wait.until(() => fixture.componentInstance.isRead());
      return new OpenedFiles(fixture, answers);
    }

    it("marks the line as the diff leaves it, counting each hunk's header and skipping removed lines, and scrolls it into view", async () => {
      const { fixture } = await openAsync();
      const scrolled: HTMLElement[] = [];
      vi.spyOn(HTMLElement.prototype, "scrollIntoView").mockImplementation(function (this: HTMLElement) {
        scrolled.push(this);
      });
      const element: HTMLElement = fixture.nativeElement;
      const holds = [fixture.componentInstance.holds("src/app.ts"), fixture.componentInstance.holds("src/new.ts")];

      fixture.componentInstance.reveal("src/app.ts", 21);
      await Wait.until(() => scrolled.length > 0);
      const first = [element.querySelector(".marked-line")?.textContent, scrolled.map(t => t.classList.contains("marked-line"))];
      fixture.componentInstance.reveal("src/app.ts", 3);
      await Wait.until(() => scrolled.length > 1);

      expect([holds, first]).toEqual([[true, false], ["+three", [true]]]);
      expect([...element.querySelectorAll(".marked-line")].map(t => t.textContent)).toEqual([" one"]);
    });

    it("scrolls to the file's row and marks nothing for a line no hunk shows, a removed line's old number among them, and drops the mark on a new read", async () => {
      const { fixture, answers } = await openAsync();
      const scrolled: HTMLElement[] = [];
      vi.spyOn(HTMLElement.prototype, "scrollIntoView").mockImplementation(function (this: HTMLElement) {
        scrolled.push(this);
      });
      const element: HTMLElement = fixture.nativeElement;
      fixture.componentInstance.reveal("src/app.ts", 4);
      await Wait.until(() => scrolled.length > 0);
      const missed = [element.querySelector(".marked-line"), scrolled.map(t => t.getAttribute("title"))];
      fixture.componentInstance.reveal("src/app.ts", 22);
      await Wait.until(() => scrolled.length > 1);
      const marked: boolean = !Object.isNull(element.querySelector(".marked-line"));

      fixture.componentRef.setInput("scope", new DiffScope(DiffScopeKind.Range, "1".repeat(40), "9".repeat(40)));
      await Wait.until(() => answers.length === 0 && fixture.componentInstance.isRead());

      expect([missed, marked, element.querySelector(".marked-line"), element.querySelector(".file-row.open")]).toEqual([[null, ["src/app.ts"]], true, null, null]);
    });
  });
});
