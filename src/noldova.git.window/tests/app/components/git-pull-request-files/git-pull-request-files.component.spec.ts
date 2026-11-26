/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { type ComponentFixture, TestBed } from "@angular/core/testing";
import "@noldova/context.core";
import { WindowPartTokens } from "@noldova/desktop.window";
import { FakeWindowPartContext } from "@noldova/desktop.window/testing";
import { FileChangeKind, HostPullRequestFile, HostPullRequestFiles, HostReference } from "@noldova/git.hosting.protocol";
import { DiffFile, DiffHunk, DiffLine, DiffScope, DiffScopeKind, DiffTotals, FileChange, GitCommitDetailParams, GitDiff, GitDiffParams, GitFetchParams, GitNames, GitRemote,
  GitStatus, LineKind, RemoteTransport } from "@noldova/git.protocol";
import { describe, expect, it } from "vitest";

import { GitPullRequestFilesComponent } from "../../../../src/app/components/git-pull-request-files/git-pull-request-files.component.ts";
import { GitFileLine } from "../../../../src/app/models/git-file-line.ts";
import { RequestAnswers } from "../../../fixtures/request-answers.fixture.ts";
import { TestPullRequestHost } from "../../../fixtures/test-pull-request-host.fixture.ts";
import { UnhandledRejections } from "../../../fixtures/unhandled-rejections.fixture.ts";
import { WindowFailure } from "../../../fixtures/window-failure.fixture.ts";
import { Wait } from "../../../fixtures/wait.fixture.ts";

const REPOSITORY: string = "3f2504e0-4f89-11d3-9a0c-0305e82c3301";
const URL: string = "https://example.com/fabrikam/site/pulls/752";
const SOURCE: string = "9fceb02d0ae598e95dc970b74767f19372d61af8";
const COMMON: string = "0123456789abcdef0123456789abcdef01234567";
const FOLDER: string = "/work/site";
const reference: HostReference = new HostReference("git-example", "fabrikam", REPOSITORY, 752);
const other: HostReference = new HostReference("git-example", "fabrikam", REPOSITORY, 7);
const status: GitStatus = new GitStatus("main", "a".repeat(40), null, [], false, "f1", null,
  new GitRemote("origin", "example.com", "fabrikam/site", RemoteTransport.Https));
const changed: HostPullRequestFiles = new HostPullRequestFiles(SOURCE, COMMON, [new HostPullRequestFile("src/new.ts", FileChangeKind.Added, null),
  new HostPullRequestFile("src/app.ts", FileChangeKind.Modified, null), new HostPullRequestFile("old.md", FileChangeKind.Deleted, null),
  new HostPullRequestFile("docs/guide.md", FileChangeKind.Renamed, "guide.md")], false);
const scope: DiffScope = new DiffScope(DiffScopeKind.Range, COMMON, SOURCE);
/** The push's diff of `src/app.ts` from local Git: one hunk at new lines 40 to 42, with line 41 added. */
const appDiff: GitDiff = new GitDiff([new DiffFile("src/app.ts", undefined, "src/app.ts", undefined, FileChange.Modified, null, null, false, null,
  [new DiffHunk(40, 2, 40, 3, "", [new DiffLine(LineKind.Context, 40, 40, "const a = 1;"), new DiffLine(LineKind.Added, null, 41, "const b = 2;"),
    new DiffLine(LineKind.Context, 41, 42, "export { a, b };")])], false)], 0, 0, false);

function wordsOf(node: Node): string {
  const words: string[] = [];
  const walker = document.createTreeWalker(node, NodeFilter.SHOW_TEXT);
  for (let text = walker.nextNode(); !Object.isNull(text); text = walker.nextNode())
    words.push((text.textContent ?? "").trim());
  return words.filter(t => t.length > 0).join(" ").replace(/\s+/g, " ");
}

class Tab {
  public readonly context: FakeWindowPartContext = new FakeWindowPartContext();
  public readonly requests: RequestAnswers = new RequestAnswers(this.context);
  public readonly host: TestPullRequestHost = new TestPullRequestHost();
  public readonly counts: string[] = [];
  public readonly unrevealed: GitFileLine[] = [];
  public fixture: ComponentFixture<GitPullRequestFilesComponent> | null = null;

  public get element(): HTMLElement {
    const element = this.fixture?.nativeElement;
    if (!(element instanceof HTMLElement))
      throw new Error("The tab isn't open.");
    return element;
  }

  public get logs(): readonly unknown[] {
    return this.context.callsOf("log").map(t => t[0]);
  }

  /** Opens the tab, given the files the page already read, or `null` for the tab to read them. */
  public create(answer: HostPullRequestFiles | null = null): void {
    TestBed.configureTestingModule({ providers: [{ provide: WindowPartTokens.context, useValue: this.context }] });
    this.fixture = TestBed.createComponent(GitPullRequestFilesComponent);
    this.fixture.componentRef.setInput("answer", answer);
    this.fixture.componentRef.setInput("host", this.host);
    this.fixture.componentRef.setInput("reference", reference);
    this.fixture.componentRef.setInput("url", URL);
    this.fixture.componentInstance.counted.subscribe(t => this.counts.push(t));
    this.fixture.componentInstance.unrevealed.subscribe(t => this.unrevealed.push(t));
    this.fixture.autoDetectChanges();
  }

  public async openAsync(): Promise<this> {
    this.create();
    await this.settleAsync();
    return this;
  }

  public async settleAsync(): Promise<void> {
    await this.fixture?.whenStable();
    this.fixture?.detectChanges();
    await this.fixture?.whenStable();
  }

  public reveal(line: GitFileLine): void {
    this.fixture?.componentRef.setInput("reveal", line);
  }

  /** Opens the tab on a repository that is the pull request's and has the push's commits, so it shows the changes from local Git, read as `diff` says. */
  public async openLocalAsync(diff: GitDiff | WindowFailure, line: GitFileLine): Promise<this> {
    this.host.folder = FOLDER;
    this.requests.answer(TestPullRequestHost.changesMethod, changed.toJson());
    this.requests.answer(GitNames.commitDetailMethod, {}, {});
    this.requests.answer(GitNames.diffTotalsMethod, new DiffTotals(1, 1, 0).toJson());
    if (diff instanceof GitDiff)
      this.requests.answer(GitNames.diffMethod, diff.toJson());
    else
      this.requests.fail(GitNames.diffMethod, diff);
    this.create();
    this.reveal(line);
    await this.requests.askedAsync(5);
    await Wait.until(() => this.unrevealed.length > 0 || !Object.isNull(this.element.querySelector(".marked-line")));
    return this;
  }

  /** The marked diff line's text as it reads, which its colored runs split into spans. */
  public marked(): (string | null)[] {
    return [...this.element.querySelectorAll(".diff .marked-line")].map(t => t.textContent);
  }

  public texts(selector: string): string[] {
    return [...this.element.querySelectorAll(selector)].map(wordsOf);
  }

  public async clickAsync(selector: string): Promise<void> {
    const found = this.element.querySelector<HTMLElement>(selector);
    if (Object.isNull(found))
      throw new Error(`Nothing matches ${selector}.`);
    found.click();
    await this.settleAsync();
  }
}

function filesOf(count: number): HostPullRequestFiles {
  return new HostPullRequestFiles(SOURCE, COMMON, Array.from({ length: count }, (_, i) => new HostPullRequestFile(`f${String(i)}.ts`, FileChangeKind.Modified, null)),
    count === 1000);
}

describe("GitPullRequestFilesComponent", () => {
  it("lists the paths the host names with what changed, a moved file's old path, and that opening the repository shows the changes, with no repository open",
    async () => {
      const tab = new Tab();
      tab.requests.answer(TestPullRequestHost.changesMethod, changed.toJson());
      await tab.openAsync();

      expect([tab.requests.methods, tab.requests.payloads]).toEqual([[TestPullRequestHost.changesMethod], [reference.toJson()]]);
      expect([tab.texts(".row .path"), tab.texts(".row .letter"), tab.element.querySelectorAll(".row:not(.folder) nol-file-badge").length])
        .toEqual([["docs", "guide.md from guide.md", "src", "new.ts", "app.ts", "old.md"], ["R", "A", "M", "D"], 4]);
      expect([tab.texts(".hint"), tab.element.querySelector("button.fetch"), tab.element.querySelector("nol-git-diff-files"), tab.counts])
        .toEqual([["Open this repository in Git to see each file's changes."], null, null, ["4"]]);
    });

  it("lays the host's paths out as the layout button chooses, a tree, folders or a list, and closes and opens a folder its row is clicked on", async () => {
    const tab = new Tab();
    tab.requests.answer(TestPullRequestHost.changesMethod, changed.toJson());
    await tab.openAsync();
    const choose = async (label: string): Promise<string[]> => {
      await tab.clickAsync("button.layout");
      await Wait.until(() => !Object.isNull(document.querySelector("button[nol-menu-item]")));
      [...document.querySelectorAll<HTMLElement>("button[nol-menu-item]")].find(t => t.textContent.includes(label))?.click();
      await Wait.until(() => Object.isNull(document.querySelector("button[nol-menu-item]")));
      await tab.settleAsync();
      return tab.texts(".row .path");
    };

    await tab.clickAsync(".row.folder");
    const closed = [tab.texts(".row .path"), tab.element.querySelector(".row.folder")?.getAttribute("aria-expanded")];
    await tab.clickAsync(".row.folder");
    const list: string[] = await choose("List");
    const tree: string[] = await choose("Tree");

    expect([closed, list, tree]).toEqual([[["docs", "src", "new.ts", "app.ts", "old.md"], "false"],
      ["src/new.ts", "src/app.ts", "old.md", "docs/guide.md from guide.md"], ["docs", "guide.md from guide.md", "src", "new.ts", "app.ts", "old.md"]]);
  });

  it("says when the host has more than the files it shows, 1000 or fewer, and when there are none, with no hint for no files", async () => {
    const full = new Tab();
    full.requests.answer(TestPullRequestHost.changesMethod, filesOf(1000).toJson());
    await full.openAsync();
    const fewer = new Tab();
    TestBed.resetTestingModule();
    fewer.requests.answer(TestPullRequestHost.changesMethod, new HostPullRequestFiles(SOURCE, COMMON, filesOf(961).files, true).toJson());
    await fewer.openAsync();
    const none = new Tab();
    TestBed.resetTestingModule();
    none.requests.answer(TestPullRequestHost.changesMethod, new HostPullRequestFiles(null, null, [], false).toJson());
    await none.openAsync();

    expect([full.texts(".cap"), full.counts, fewer.texts(".cap"), fewer.counts, none.texts(".empty"), none.texts(".hint"), none.counts])
      .toEqual([["Showing the first 1000."], ["1000+"], ["Showing the first 961."], ["961+"], ["No changed files."], [], ["0"]]);
  });

  it("shows the changes from local Git when the open repository is the pull request's and has the push's head and common commits, counting the files Git "
    + "counts", async () => {
    const tab = new Tab();
    tab.host.folder = FOLDER;
    tab.requests.answer(TestPullRequestHost.changesMethod, changed.toJson());
    tab.requests.answer(GitNames.commitDetailMethod, {}, {});
    tab.requests.answer(GitNames.diffTotalsMethod, new DiffTotals(5, 9, 2).toJson());
    tab.requests.fail(GitNames.diffMethod, new WindowFailure("Not now."));
    await tab.openAsync();

    expect([!Object.isNull(tab.element.querySelector("nol-git-diff-files")), tab.texts(".row:not(.folder)"), tab.counts, tab.host.asked]).toEqual([true, [], ["5"], [URL]]);
    expect(tab.requests.methods.slice(1)).toEqual([GitNames.commitDetailMethod, GitNames.commitDetailMethod, GitNames.diffTotalsMethod, GitNames.diffMethod]);
    expect(tab.requests.payloads.slice(1)).toEqual([new GitCommitDetailParams(FOLDER, COMMON).toJson(), new GitCommitDetailParams(FOLDER, SOURCE).toJson(),
      new GitDiffParams(FOLDER, scope).toJson(), new GitDiffParams(FOLDER, scope).toJson()]);
  });

  it("counts the host's files and logs why when local Git can't count the changes it shows", async () => {
    const tab = new Tab();
    tab.host.folder = FOLDER;
    tab.requests.answer(TestPullRequestHost.changesMethod, changed.toJson());
    tab.requests.answer(GitNames.commitDetailMethod, {}, {});
    tab.requests.fail(GitNames.diffTotalsMethod, new WindowFailure("Not now."));
    tab.requests.fail(GitNames.diffMethod, new WindowFailure("Not now."));
    await tab.openAsync();

    expect([!Object.isNull(tab.element.querySelector("nol-git-diff-files")), tab.counts, tab.logs.filter(t => String(t).includes(GitNames.diffTotalsMethod)).length])
      .toEqual([true, ["4"], 1]);
  });

  it("offers a fetch when the open repository lacks the push's commits, fetches with the status's fingerprint, then shows the changes from local Git", async () => {
    const tab = new Tab();
    tab.host.folder = FOLDER;
    tab.requests.answer(TestPullRequestHost.changesMethod, changed.toJson(), changed.toJson());
    tab.requests.answer(GitNames.statusMethod, status.toJson());
    tab.requests.fail(GitNames.commitDetailMethod, new WindowFailure("Unknown revision."));
    tab.requests.answer(GitNames.commitDetailMethod, {}, {}, {});
    tab.requests.answer(GitNames.fetchMethod, null);
    tab.requests.answer(GitNames.diffTotalsMethod, new DiffTotals(5, 9, 2).toJson());
    tab.requests.fail(GitNames.diffMethod, new WindowFailure("Not now."));
    await tab.openAsync();
    const offered = [tab.texts(".hint"), tab.texts(".row:not(.folder)").length, tab.logs];

    await tab.clickAsync("button.fetch");
    await tab.requests.askedAsync(10);
    await tab.settleAsync();

    expect(offered).toEqual([["Fetch to see each file's changes. Fetch"], 4, []]);
    expect(tab.requests.payloads[tab.requests.methods.indexOf(GitNames.fetchMethod)]).toEqual(new GitFetchParams(FOLDER, "f1").toJson());
    expect([!Object.isNull(tab.element.querySelector("nol-git-diff-files")), tab.texts(".hint"), tab.counts]).toEqual([true, [], ["4", "5"]]);
  });

  it("logs a fetch the window fails and says so in the hint, keeping the list", async () => {
    const tab = new Tab();
    tab.host.folder = FOLDER;
    tab.requests.answer(TestPullRequestHost.changesMethod, changed.toJson());
    tab.requests.answer(GitNames.statusMethod, status.toJson());
    tab.requests.fail(GitNames.commitDetailMethod, new WindowFailure("Unknown revision."));
    tab.requests.fail(GitNames.fetchMethod, new WindowFailure("The remote refused."));
    await tab.openAsync();

    await tab.clickAsync("button.fetch");

    expect([tab.texts(".hint"), tab.texts(".row:not(.folder)").length, tab.logs]).toEqual([["The fetch didn't finish. Try again to see each file's changes. Fetch"], 4,
      ["The Example module's git.fetch request failed: WindowFailure: The remote refused."]]);
  });

  it("lists the paths with no fetch offered when the host doesn't say where the changes count from, and checks no commits for a pull request with no head commit",
    async () => {
      const tab = new Tab();
      tab.host.folder = FOLDER;
      tab.requests.answer(TestPullRequestHost.changesMethod, new HostPullRequestFiles(SOURCE, null, changed.files, false).toJson());
      await tab.openAsync();
      TestBed.resetTestingModule();
      const empty = new Tab();
      empty.host.folder = FOLDER;
      empty.requests.answer(TestPullRequestHost.changesMethod, new HostPullRequestFiles(null, null, [], false).toJson());
      await empty.openAsync();

      expect([tab.texts(".row:not(.folder)").length, tab.texts(".hint"), tab.requests.methods]).toEqual([4, [], [TestPullRequestHost.changesMethod]]);
      expect([empty.texts(".empty"), empty.requests.methods]).toEqual([["No changed files."], [TestPullRequestHost.changesMethod]]);
    });

  it("says it is reading until the answer comes", async () => {
    const tab = new Tab();
    const release = tab.requests.hold(TestPullRequestHost.changesMethod);
    tab.create();
    await tab.requests.askedAsync(1);
    tab.fixture?.detectChanges();

    expect(tab.texts("[role=status]")).toEqual(["Reading the files on Example."]);
    release(changed.toJson());
    await tab.settleAsync();
    expect(tab.texts(".row:not(.folder)")).toHaveLength(4);
  });

  it("logs a read the window fails, offers to try again, and shows the files the retry reads", async () => {
    const tab = new Tab();
    tab.requests.fail(TestPullRequestHost.changesMethod, new WindowFailure("The runtime stopped."));
    tab.requests.answer(TestPullRequestHost.changesMethod, changed.toJson());
    await tab.openAsync();

    expect([tab.texts("[role=alert]"), tab.logs, tab.counts]).toEqual([["error Example didn't answer. Try again to read the files. Try again"],
      ["The Example module's git-example.readPullRequestChanges request failed: WindowFailure: The runtime stopped."], []]);
    await tab.clickAsync("[role=alert] button");
    expect([tab.texts(".row:not(.folder)").length, tab.counts]).toEqual([4, ["4"]]);
  });

  it("drops an answer or a failure for a pull request it left", async () => {
    const tab = new Tab();
    const release = tab.requests.hold(TestPullRequestHost.changesMethod);
    const fail = tab.requests.holdFailure(TestPullRequestHost.changesMethod);
    tab.requests.answer(TestPullRequestHost.changesMethod, filesOf(0).toJson());
    tab.create();
    await tab.requests.askedAsync(1);

    tab.fixture?.componentRef.setInput("reference", other);
    await tab.requests.askedAsync(2);
    tab.fixture?.componentRef.setInput("reference", reference);
    await tab.requests.askedAsync(3);
    release(changed.toJson());
    fail(new WindowFailure("The runtime stopped."));
    await Promise.allSettled(tab.requests.answered);
    await tab.settleAsync();

    expect([tab.texts(".empty"), tab.element.querySelector("[role=alert]"), tab.counts, tab.logs.length]).toEqual([["No changed files."], null, ["0"], 1]);
  });

  it("shows the files the page handed over without asking the host, and asks for another pull request and on Try again", async () => {
    const tab = new Tab();
    tab.requests.answer(TestPullRequestHost.changesMethod, filesOf(2).toJson());
    tab.requests.fail(TestPullRequestHost.changesMethod, new WindowFailure("The runtime stopped."));
    tab.requests.answer(TestPullRequestHost.changesMethod, filesOf(3).toJson());
    tab.create(changed);
    await tab.settleAsync();
    const handed = [tab.texts(".row:not(.folder)").length, [...tab.counts], [...tab.requests.methods]];

    tab.fixture?.componentRef.setInput("reference", other);
    await tab.requests.askedAsync(1);
    await tab.settleAsync();
    const another = [tab.texts(".row:not(.folder)").length, [...tab.requests.payloads]];
    tab.fixture?.componentRef.setInput("reference", reference);
    await tab.requests.askedAsync(2);
    await tab.settleAsync();
    await tab.clickAsync("[role=alert] button");
    await tab.requests.askedAsync(3);
    await tab.settleAsync();

    expect(handed).toEqual([4, ["4"], []]);
    expect(another).toEqual([2, [other.toJson()]]);
    expect([tab.texts(".row:not(.folder)").length, tab.counts, tab.requests.payloads.slice(1)]).toEqual([3, ["4", "2", "3"], [reference.toJson(), reference.toJson()]]);
  });

  it("opens the file of a line to reveal in the changes from local Git once they are read, marking the line, and marks a new line given after", async () => {
    const tab = await new Tab().openLocalAsync(appDiff, new GitFileLine("src/app.ts", 41));
    const marked = [tab.element.querySelector(".file-row.open")?.getAttribute("title"), tab.marked()];

    tab.reveal(new GitFileLine("src/app.ts", 42));
    await Wait.until(() => tab.marked()[0] !== "+const b = 2;");

    expect(marked).toEqual(["src/app.ts", ["+const b = 2;"]]);
    expect([tab.marked(), tab.unrevealed]).toEqual([[" export { a, b };"], []]);
  });

  it("says once that it can't reveal a line without the changes from local Git, when they don't hold its file, or when they or the files fail to read", async () => {
    const line = new GitFileLine("src/app.ts", 41);
    const away = new Tab();
    away.requests.answer(TestPullRequestHost.changesMethod, changed.toJson());
    away.create();
    away.reveal(line);
    await Wait.until(() => away.unrevealed.length > 0);
    await away.settleAsync();
    TestBed.resetTestingModule();
    const elsewhere = new GitFileLine("src/new.ts", 1);
    const missing = await new Tab().openLocalAsync(appDiff, elsewhere);
    TestBed.resetTestingModule();
    const unread = await new Tab().openLocalAsync(new WindowFailure("Not now."), line);
    TestBed.resetTestingModule();
    const failed = new Tab();
    failed.requests.fail(TestPullRequestHost.changesMethod, new WindowFailure("The runtime stopped."));
    failed.create();
    failed.reveal(line);
    await Wait.until(() => failed.unrevealed.length > 0);
    await failed.settleAsync();

    expect([away.unrevealed, missing.unrevealed, missing.element.querySelector(".file-row.open"), unread.unrevealed, failed.unrevealed])
      .toEqual([[line], [elsewhere], null, [line], [line]]);
  });

  it("waits for the changes from local Git to be read before it reveals a line", async () => {
    const tab = new Tab();
    tab.host.folder = FOLDER;
    tab.requests.answer(TestPullRequestHost.changesMethod, changed.toJson());
    tab.requests.answer(GitNames.commitDetailMethod, {}, {});
    tab.requests.answer(GitNames.diffTotalsMethod, new DiffTotals(1, 1, 0).toJson());
    const release = tab.requests.hold(GitNames.diffMethod);
    tab.create();
    tab.reveal(new GitFileLine("src/app.ts", 41));
    await tab.requests.askedAsync(5);
    await tab.settleAsync();
    const waiting = [tab.element.querySelector(".file-row.open"), tab.unrevealed.length];

    release(appDiff.toJson());
    await Wait.until(() => tab.marked().length > 0);

    expect([waiting, tab.marked(), tab.unrevealed]).toEqual([[null, 0], ["+const b = 2;"], []]);
  });

  it("rethrows a failure that isn't the window's while it reads, finds the repository, checks the commits, counts the changes or fetches", async () => {
    const reading = new Tab();
    const readRejection: Promise<unknown> = UnhandledRejections.nextAsync();
    reading.requests.fail(TestPullRequestHost.changesMethod, new RangeError("Unexpected."));
    await reading.openAsync();
    expect(await readRejection).toBeInstanceOf(RangeError);

    TestBed.resetTestingModule();
    const finding = new Tab();
    finding.host.failure = new RangeError("Unexpected.");
    const findRejection: Promise<unknown> = UnhandledRejections.nextAsync();
    finding.requests.answer(TestPullRequestHost.changesMethod, changed.toJson());
    await finding.openAsync();
    expect(await findRejection).toBeInstanceOf(RangeError);

    TestBed.resetTestingModule();
    const checking = new Tab();
    checking.host.folder = FOLDER;
    const checkRejection: Promise<unknown> = UnhandledRejections.nextAsync();
    checking.requests.answer(TestPullRequestHost.changesMethod, changed.toJson());
    checking.requests.fail(GitNames.commitDetailMethod, new RangeError("Unexpected."));
    await checking.openAsync();
    expect(await checkRejection).toBeInstanceOf(RangeError);

    TestBed.resetTestingModule();
    const counting = new Tab();
    counting.host.folder = FOLDER;
    const countRejection: Promise<unknown> = UnhandledRejections.nextAsync();
    counting.requests.answer(TestPullRequestHost.changesMethod, changed.toJson());
    counting.requests.answer(GitNames.commitDetailMethod, {}, {});
    counting.requests.fail(GitNames.diffTotalsMethod, new RangeError("Unexpected."));
    await counting.openAsync();
    expect(await countRejection).toBeInstanceOf(RangeError);

    TestBed.resetTestingModule();
    const fetching = new Tab();
    fetching.host.folder = FOLDER;
    fetching.requests.answer(TestPullRequestHost.changesMethod, changed.toJson());
    fetching.requests.fail(GitNames.commitDetailMethod, new WindowFailure("Unknown revision."));
    fetching.requests.fail(GitNames.statusMethod, new RangeError("Unexpected."));
    await fetching.openAsync();
    const fetchRejection: Promise<unknown> = UnhandledRejections.nextAsync();
    await fetching.clickAsync("button.fetch");
    expect(await fetchRejection).toBeInstanceOf(RangeError);
  });
});
