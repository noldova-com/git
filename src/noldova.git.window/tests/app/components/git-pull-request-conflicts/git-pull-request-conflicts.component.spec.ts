/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { type ComponentFixture, TestBed } from "@angular/core/testing";
import { WindowPartTokens } from "@noldova/desktop.window";
import { FakeWindowPartContext } from "@noldova/desktop.window/testing";
import { HostChanges, HostPullRequestConflicts, HostReference } from "@noldova/git.hosting.protocol";
import { GitNames, GitOperation, GitRemote, GitStatus, OperationKind, RemoteTransport } from "@noldova/git.protocol";
import { describe, expect, it } from "vitest";

import { GitPullRequestConflictsComponent } from "../../../../src/app/components/git-pull-request-conflicts/git-pull-request-conflicts.component.ts";
import { RequestAnswers } from "../../../fixtures/request-answers.fixture.ts";
import { TestPullRequestHost } from "../../../fixtures/test-pull-request-host.fixture.ts";
import { UnhandledRejections } from "../../../fixtures/unhandled-rejections.fixture.ts";
import { WindowFailure } from "../../../fixtures/window-failure.fixture.ts";

const REPOSITORY: string = "3f2504e0-4f89-11d3-9a0c-0305e82c3301";
const URL: string = "https://example.com/fabrikam/site/pulls/752";
const HEAD: string = "0123456789abcdef0123456789abcdef01234567";
const FOLDER: string = "/work/site";
const reference: HostReference = new HostReference("git-example", "fabrikam", REPOSITORY, 752);
const other: HostReference = new HostReference("git-example", "fabrikam", REPOSITORY, 7);
const changes: HostChanges = new HostChanges(null, null, null, "users/monalisa/export-notes", "main", HEAD);
const conflicts: HostPullRequestConflicts = new HostPullRequestConflicts(["src/app.ts", "README.md"], false);
const merge: GitOperation = new GitOperation(OperationKind.Merge, HEAD, null);
const statusOf = (branch: string | null, operation: GitOperation | null): GitStatus => new GitStatus(branch, "a".repeat(40), null, [], false, "f1", operation,
  new GitRemote("origin", "example.com", "fabrikam/site", RemoteTransport.Https));

function wordsOf(node: Node): string {
  const words: string[] = [];
  const walker = document.createTreeWalker(node, NodeFilter.SHOW_TEXT);
  for (let text = walker.nextNode(); text !== null; text = walker.nextNode())
    words.push((text.textContent ?? "").trim());
  return words.filter(t => t.length > 0).join(" ").replace(/\s+/g, " ");
}

class Tab {
  public readonly context: FakeWindowPartContext = new FakeWindowPartContext();
  public readonly requests: RequestAnswers = new RequestAnswers(this.context);
  public readonly host: TestPullRequestHost = new TestPullRequestHost();
  public readonly counts: string[] = [];
  public fixture: ComponentFixture<GitPullRequestConflictsComponent> | null = null;

  public get element(): HTMLElement {
    const element = this.fixture?.nativeElement;
    if (!(element instanceof HTMLElement))
      throw new Error("The tab isn't open.");
    return element;
  }

  public get logs(): readonly unknown[] {
    return this.context.callsOf("log").map(t => t[0]);
  }

  public create(): void {
    TestBed.configureTestingModule({ providers: [{ provide: WindowPartTokens.context, useValue: this.context }] });
    this.fixture = TestBed.createComponent(GitPullRequestConflictsComponent);
    this.fixture.componentRef.setInput("host", this.host);
    this.fixture.componentRef.setInput("reference", reference);
    this.fixture.componentRef.setInput("url", URL);
    this.fixture.componentRef.setInput("changes", changes);
    this.fixture.componentInstance.counted.subscribe(t => this.counts.push(t));
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

  public async showAsync(next: HostReference, changed: HostChanges | null = changes): Promise<void> {
    this.fixture?.componentRef.setInput("changes", changed);
    this.fixture?.componentRef.setInput("reference", next);
    await this.settleAsync();
  }

  public texts(selector: string): string[] {
    return [...this.element.querySelectorAll(selector)].map(wordsOf);
  }

  public async clickAsync(selector: string): Promise<void> {
    const found = this.element.querySelector<HTMLElement>(selector);
    if (found === null)
      throw new Error(`Nothing matches ${selector}.`);
    found.click();
    await this.settleAsync();
  }
}

function conflictsOf(count: number): HostPullRequestConflicts {
  return new HostPullRequestConflicts(Array.from({ length: count }, (_, i) => `f${String(i)}.ts`), count === 100);
}

describe("GitPullRequestConflictsComponent", () => {
  it("lists the conflicting paths as plain rows with no repository open, and counts them once read", async () => {
    const tab = new Tab();
    tab.requests.answer(TestPullRequestHost.conflictsMethod, conflicts.toJson());
    await tab.openAsync();

    expect([tab.requests.methods, tab.requests.payloads]).toEqual([[TestPullRequestHost.conflictsMethod], [reference.toJson()]]);
    expect([tab.texts("div.row"), tab.element.querySelectorAll("button.row").length, tab.texts(".cap"), tab.counts])
      .toEqual([["warning src/app.ts", "warning README.md"], 0, [], ["2"]]);
  });

  it("says when the host has more than the 100 it shows, and when there are none, reading no status for none", async () => {
    const full = new Tab();
    full.requests.answer(TestPullRequestHost.conflictsMethod, conflictsOf(100).toJson());
    await full.openAsync();
    TestBed.resetTestingModule();
    const none = new Tab();
    none.host.folder = FOLDER;
    none.requests.answer(TestPullRequestHost.conflictsMethod, conflictsOf(0).toJson());
    await none.openAsync();

    expect([full.texts(".cap"), full.counts, none.texts(".empty"), none.counts, none.requests.methods]).toEqual([["Showing the first 100."], ["100+"],
      ["No conflicts."], ["0"], [TestPullRequestHost.conflictsMethod]]);
  });

  it("opens the repository's Conflicts screen from a row when it is merging on the pull request's target or source branch, and logs a screen it can't open",
    async () => {
      const tab = new Tab();
      tab.host.folder = FOLDER;
      tab.requests.answer(TestPullRequestHost.conflictsMethod, conflicts.toJson(), conflicts.toJson());
      tab.requests.answer(GitNames.statusMethod, statusOf("main", merge).toJson(), statusOf("users/monalisa/export-notes", merge).toJson());
      let calls = 0;
      tab.context.answer("runCommandAsync", async () => {
        calls++;
        if (calls === 2)
          throw new WindowFailure("No Git module.");
        return null;
      });
      await tab.openAsync();
      const labels = [...tab.element.querySelectorAll("button.row")].map(t => t.getAttribute("aria-label"));

      await tab.clickAsync("button.row");
      await tab.showAsync(other);
      await tab.clickAsync("button.row");

      expect(labels).toEqual(["Open the conflicts in Git, at src/app.ts", "Open the conflicts in Git, at README.md"]);
      expect([tab.context.callsOf("runCommandAsync"), tab.logs]).toEqual([[["git.openConflicts", { folder: FOLDER }], ["git.openConflicts", { folder: FOLDER }]],
        ["The Example module's git.openConflicts request failed: WindowFailure: No Git module."]]);
    });

  it("keeps the rows plain when the open repository isn't merging, is in another operation, merges another branch, has no branch, or the branches aren't known",
    async () => {
      const tab = new Tab();
      tab.host.folder = FOLDER;
      const statuses: readonly GitStatus[] = [statusOf("main", null), statusOf("main", new GitOperation(OperationKind.Rebase, HEAD, null)),
        statusOf("release", merge), statusOf(null, merge), statusOf("main", merge)];
      tab.requests.answer(TestPullRequestHost.conflictsMethod, ...statuses.map(() => conflicts.toJson()));
      tab.requests.answer(GitNames.statusMethod, ...statuses.map(t => t.toJson()));
      await tab.openAsync();
      const plain: number[] = [tab.element.querySelectorAll("button.row").length];
      for (const [i, changed] of [changes, changes, changes, null].entries()) {
        await tab.showAsync(new HostReference("git-example", "fabrikam", REPOSITORY, i + 1), changed);
        plain.push(tab.element.querySelectorAll("button.row").length);
      }

      expect([plain, tab.texts("div.row").length]).toEqual([[0, 0, 0, 0, 0], 2]);
    });

  it("logs a status it can't read for the merge and keeps the rows plain", async () => {
    const tab = new Tab();
    tab.host.folder = FOLDER;
    tab.requests.answer(TestPullRequestHost.conflictsMethod, conflicts.toJson());
    tab.requests.fail(GitNames.statusMethod, new WindowFailure("No Git module."));
    await tab.openAsync();

    expect([tab.texts("div.row").length, tab.logs]).toEqual([2, ["The Example module's git.status request failed: WindowFailure: No Git module."]]);
  });

  it("says it is reading until the answer comes", async () => {
    const tab = new Tab();
    const release = tab.requests.hold(TestPullRequestHost.conflictsMethod);
    tab.create();
    await tab.requests.askedAsync(1);
    tab.fixture?.detectChanges();

    expect(tab.texts("[role=status]")).toEqual(["Reading the conflicts on Example."]);
    release(conflicts.toJson());
    await tab.settleAsync();
    expect(tab.texts(".row")).toHaveLength(2);
  });

  it("logs a read the window fails, offers to try again, and shows the conflicts the retry reads", async () => {
    const tab = new Tab();
    tab.requests.fail(TestPullRequestHost.conflictsMethod, new WindowFailure("The runtime stopped."));
    tab.requests.answer(TestPullRequestHost.conflictsMethod, conflicts.toJson());
    await tab.openAsync();

    expect([tab.texts("[role=alert]"), tab.logs, tab.counts]).toEqual([["error Example didn't answer. Try again to read the conflicts. Try again"],
      ["The Example module's git-example.readPullRequestConflicts request failed: WindowFailure: The runtime stopped."], []]);
    await tab.clickAsync("[role=alert] button");
    expect([tab.texts(".row").length, tab.counts]).toEqual([2, ["2"]]);
  });

  it("drops an answer or a failure for a pull request it left", async () => {
    const tab = new Tab();
    const release = tab.requests.hold(TestPullRequestHost.conflictsMethod);
    const fail = tab.requests.holdFailure(TestPullRequestHost.conflictsMethod);
    tab.requests.answer(TestPullRequestHost.conflictsMethod, conflictsOf(0).toJson());
    tab.create();
    await tab.requests.askedAsync(1);

    tab.fixture?.componentRef.setInput("reference", other);
    await tab.requests.askedAsync(2);
    tab.fixture?.componentRef.setInput("reference", reference);
    await tab.requests.askedAsync(3);
    release(conflicts.toJson());
    fail(new WindowFailure("The runtime stopped."));
    await Promise.allSettled(tab.requests.answered);
    await tab.settleAsync();

    expect([tab.texts(".empty"), tab.element.querySelector("[role=alert]"), tab.counts, tab.logs.length]).toEqual([["No conflicts."], null, ["0"], 1]);
  });

  it("rethrows a failure that isn't the window's while it reads, finds the repository, reads the merge or opens the Conflicts screen", async () => {
    const reading = new Tab();
    const readRejection: Promise<unknown> = UnhandledRejections.nextAsync();
    reading.requests.fail(TestPullRequestHost.conflictsMethod, new RangeError("Unexpected."));
    await reading.openAsync();
    expect(await readRejection).toBeInstanceOf(RangeError);

    TestBed.resetTestingModule();
    const finding = new Tab();
    finding.host.failure = new RangeError("Unexpected.");
    const findRejection: Promise<unknown> = UnhandledRejections.nextAsync();
    finding.requests.answer(TestPullRequestHost.conflictsMethod, conflicts.toJson());
    await finding.openAsync();
    expect(await findRejection).toBeInstanceOf(RangeError);

    TestBed.resetTestingModule();
    const merging = new Tab();
    merging.host.folder = FOLDER;
    const mergeRejection: Promise<unknown> = UnhandledRejections.nextAsync();
    merging.requests.answer(TestPullRequestHost.conflictsMethod, conflicts.toJson());
    merging.requests.fail(GitNames.statusMethod, new RangeError("Unexpected."));
    await merging.openAsync();
    expect(await mergeRejection).toBeInstanceOf(RangeError);

    TestBed.resetTestingModule();
    const opening = new Tab();
    opening.host.folder = FOLDER;
    opening.requests.answer(TestPullRequestHost.conflictsMethod, conflicts.toJson());
    opening.requests.answer(GitNames.statusMethod, statusOf("main", merge).toJson());
    opening.context.answer("runCommandAsync", async () => {
      throw new RangeError("Unexpected.");
    });
    await opening.openAsync();
    const openRejection: Promise<unknown> = UnhandledRejections.nextAsync();
    await opening.clickAsync("button.row");
    expect(await openRejection).toBeInstanceOf(RangeError);
  });
});
