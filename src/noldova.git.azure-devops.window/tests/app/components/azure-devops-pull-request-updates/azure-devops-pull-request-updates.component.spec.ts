/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { signal } from "@angular/core";
import { type ComponentFixture, TestBed } from "@angular/core/testing";
import "@noldova/context.core";
import { WindowPartTokens } from "@noldova/desktop.window";
import { FakeWindowPartContext } from "@noldova/desktop.window/testing";
import { AzureDevOpsNames } from "@noldova/git.azure-devops.protocol";
import { HostPerson, HostPullRequestUpdate, HostPullRequestUpdates, HostReference } from "@noldova/git.hosting.protocol";
import { GitNames, GitRemote, GitStatus, RemoteTransport } from "@noldova/git.protocol";
import { GitFolder } from "@noldova/git.window";
import { describe, expect, it, onTestFinished, vi } from "vitest";

import { AzureDevOpsPullRequestUpdatesComponent } from "../../../../src/app/components/azure-devops-pull-request-updates/azure-devops-pull-request-updates.component.ts";
import { RequestAnswers } from "../../../fixtures/request-answers.fixture.ts";
import { UnhandledRejections } from "../../../fixtures/unhandled-rejections.fixture.ts";
import { WindowFailure } from "../../../fixtures/window-failure.fixture.ts";

const REPOSITORY: string = "3f2504e0-4f89-11d3-9a0c-0305e82c3301";
const URL: string = "https://dev.azure.com/fabrikam/Web%20Site/_git/site/pullrequest/752";
const HEAD: string = "9fceb02d0ae598e95dc970b74767f19372d61af8";
const COMMON: string = "0123456789abcdef0123456789abcdef01234567";
const OLD: number = Date.UTC(2026, 0, 5, 12);
const NOW: number = Date.UTC(2026, 10, 23, 12);

/** Fixes the clock the ages read, so an age doesn't depend on how long the test takes; only Date is faked, so the page's timers still run. */
function pinNow(): void {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(NOW);
  onTestFinished(() => {
    vi.useRealTimers();
  });
}
const reference: HostReference = new HostReference("git-azure-devops", "fabrikam", REPOSITORY, 752);
const other: HostReference = new HostReference("git-azure-devops", "fabrikam", REPOSITORY, 7);
const monalisa: HostPerson = new HostPerson("monalisa@fabrikam.com", null, null);
const azureStatus: GitStatus = new GitStatus("main", "a".repeat(40), null, [], false, "f1", null,
  new GitRemote("origin", "dev.azure.com", "fabrikam/Web%20Site/_git/site", RemoteTransport.Https));

function updatesOf(count: number): HostPullRequestUpdates {
  return new HostPullRequestUpdates(Array.from({ length: count }, (_, i) => new HostPullRequestUpdate(count - i, monalisa, OLD, HEAD, COMMON)), count === 100);
}

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
  public readonly counts: string[] = [];
  public fixture: ComponentFixture<AzureDevOpsPullRequestUpdatesComponent> | null = null;

  public get element(): HTMLElement {
    const element = this.fixture?.nativeElement;
    if (!(element instanceof HTMLElement))
      throw new Error("The tab isn't open.");
    return element;
  }

  public get logs(): readonly unknown[] {
    return this.context.callsOf("log").map(t => t[0]);
  }

  /** Opens the tab, given the pushes the page already read, or `null` for the tab to read them. */
  public create(answer: HostPullRequestUpdates | null = null): void {
    TestBed.configureTestingModule({ providers: [{ provide: WindowPartTokens.context, useValue: this.context }] });
    this.fixture = TestBed.createComponent(AzureDevOpsPullRequestUpdatesComponent);
    this.fixture.componentRef.setInput("answer", answer);
    this.fixture.componentRef.setInput("reference", reference);
    this.fixture.componentRef.setInput("url", URL);
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

  public texts(selector: string): string[] {
    return [...this.element.querySelectorAll(selector)].map(wordsOf);
  }

  public async clickAsync(selector: string): Promise<void> {
    const found = this.element.querySelector(selector);
    if (!(found instanceof HTMLElement))
      throw new Error(`Nothing matches ${selector}.`);
    found.click();
    await this.settleAsync();
  }
}

describe("AzureDevOpsPullRequestUpdatesComponent", () => {
  it("lists the pushes with their number, who pushed, when and the head commit, as plain rows with no repository open", async () => {
    pinNow();
    const recent: number = NOW - 2 * 3_600_000;
    const tab = new Tab();
    tab.requests.answer(AzureDevOpsNames.readPullRequestUpdatesMethod, new HostPullRequestUpdates([new HostPullRequestUpdate(2, monalisa, recent, HEAD, COMMON),
      new HostPullRequestUpdate(1, null, OLD, COMMON, null)], false).toJson());
    await tab.openAsync();

    const old: string = new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" }).format(OLD);
    expect([tab.requests.methods, tab.requests.payloads]).toEqual([[AzureDevOpsNames.readPullRequestUpdatesMethod], [reference.toJson()]]);
    expect(tab.texts(".row")).toEqual(["Update 2 monalisa@fabrikam.com 2 h 9fceb02", `Update 1 Someone ${old} 0123456`]);
    expect([tab.element.querySelectorAll("button.row").length, tab.texts(".cap"), tab.counts]).toEqual([0, [], ["2"]]);
  });

  it("says when Azure DevOps has more than the 100 it shows, and when there are none", async () => {
    const full = new Tab();
    full.requests.answer(AzureDevOpsNames.readPullRequestUpdatesMethod, updatesOf(100).toJson());
    await full.openAsync();
    TestBed.resetTestingModule();
    const none = new Tab();
    none.requests.answer(AzureDevOpsNames.readPullRequestUpdatesMethod, updatesOf(0).toJson());
    await none.openAsync();

    expect([full.texts(".cap"), full.counts, none.texts(".empty"), none.counts]).toEqual([["Showing the latest 100."], ["100+"], ["No updates."], ["0"]]);
  });

  it("shows an update's head commit in the Git module's history when the open repository's remote is in the pull request's organization, and logs a history it can't open", async () => {
    onTestFinished(GitFolder.provide(new FakeWindowPartContext(), signal("/work/site")));
    const tab = new Tab();
    tab.requests.answer(AzureDevOpsNames.readPullRequestUpdatesMethod, updatesOf(1).toJson());
    tab.requests.answer(GitNames.statusMethod, azureStatus.toJson());
    let calls = 0;
    tab.context.answer("runCommandAsync", async () => {
      calls++;
      if (calls === 2)
        throw new WindowFailure("No Git module.");
      return null;
    });
    await tab.openAsync();

    await tab.clickAsync("button.row");
    await tab.clickAsync("button.row");

    expect([tab.context.callsOf("runCommandAsync"), tab.logs, tab.element.querySelector("button.row")?.getAttribute("aria-label")]).toEqual([
      [["git.openHistory", { folder: "/work/site" }], ["git.openHistory", { folder: "/work/site" }]],
      ["The Azure DevOps module's git.openHistory request failed: WindowFailure: No Git module."], "Show update 1 in the history"]);
  });

  it("rethrows a failure to open the history that isn't the window's", async () => {
    onTestFinished(GitFolder.provide(new FakeWindowPartContext(), signal("/work/site")));
    const tab = new Tab();
    tab.requests.answer(AzureDevOpsNames.readPullRequestUpdatesMethod, updatesOf(1).toJson());
    tab.requests.answer(GitNames.statusMethod, azureStatus.toJson());
    tab.context.answer("runCommandAsync", async () => {
      throw new RangeError("Unexpected.");
    });
    await tab.openAsync();
    const rejection: Promise<unknown> = UnhandledRejections.nextAsync();

    await tab.clickAsync("button.row");

    expect(await rejection).toBeInstanceOf(RangeError);
  });

  it("says it is reading until the answer comes", async () => {
    const tab = new Tab();
    const release = tab.requests.hold(AzureDevOpsNames.readPullRequestUpdatesMethod);
    tab.create();
    await tab.requests.askedAsync(1);
    tab.fixture?.detectChanges();

    expect(tab.texts("[role=status]")).toEqual(["Reading the updates on Azure DevOps."]);
    release(updatesOf(1).toJson());
    await tab.settleAsync();
    expect(tab.texts(".row")).toHaveLength(1);
  });

  it("logs a read the window fails, offers to try again, and shows the updates the retry reads", async () => {
    const tab = new Tab();
    tab.requests.fail(AzureDevOpsNames.readPullRequestUpdatesMethod, new WindowFailure("The runtime stopped."));
    tab.requests.answer(AzureDevOpsNames.readPullRequestUpdatesMethod, updatesOf(1).toJson());
    await tab.openAsync();

    expect([tab.texts("[role=alert]"), tab.logs, tab.counts]).toEqual([["error Azure DevOps didn't answer. Try again to read the updates. Try again"],
      ["The Azure DevOps module's git-azure-devops.readPullRequestUpdates request failed: WindowFailure: The runtime stopped."], []]);
    await tab.clickAsync("[role=alert] button");
    expect([tab.texts(".row").length, tab.counts]).toEqual([1, ["1"]]);
  });

  it("shows the pushes the page handed over without reading them, and reads for another pull request and on Try again", async () => {
    const tab = new Tab();
    tab.requests.answer(AzureDevOpsNames.readPullRequestUpdatesMethod, updatesOf(2).toJson());
    tab.requests.fail(AzureDevOpsNames.readPullRequestUpdatesMethod, new WindowFailure("The runtime stopped."));
    tab.requests.answer(AzureDevOpsNames.readPullRequestUpdatesMethod, updatesOf(3).toJson());
    tab.create(updatesOf(1));
    await tab.settleAsync();
    const handed = [tab.texts(".row").length, [...tab.counts], [...tab.requests.methods]];

    tab.fixture?.componentRef.setInput("reference", other);
    await tab.requests.askedAsync(1);
    await tab.settleAsync();
    const another = [tab.texts(".row").length, [...tab.requests.payloads]];
    tab.fixture?.componentRef.setInput("reference", reference);
    await tab.requests.askedAsync(2);
    await tab.settleAsync();
    await tab.clickAsync("[role=alert] button");
    await tab.requests.askedAsync(3);
    await tab.settleAsync();

    expect(handed).toEqual([1, ["1"], []]);
    expect(another).toEqual([2, [other.toJson()]]);
    expect([tab.texts(".row").length, tab.counts, tab.requests.payloads.slice(1)]).toEqual([3, ["1", "2", "3"], [reference.toJson(), reference.toJson()]]);
  });

  it("drops an answer or a failure for a pull request it left", async () => {
    const tab = new Tab();
    const release = tab.requests.hold(AzureDevOpsNames.readPullRequestUpdatesMethod);
    const fail = tab.requests.holdFailure(AzureDevOpsNames.readPullRequestUpdatesMethod);
    tab.requests.answer(AzureDevOpsNames.readPullRequestUpdatesMethod, updatesOf(0).toJson());
    tab.create();
    await tab.requests.askedAsync(1);

    tab.fixture?.componentRef.setInput("reference", other);
    await tab.requests.askedAsync(2);
    tab.fixture?.componentRef.setInput("reference", reference);
    await tab.requests.askedAsync(3);
    release(updatesOf(1).toJson());
    fail(new WindowFailure("The runtime stopped."));
    await tab.settleAsync();

    expect([tab.texts(".empty"), tab.element.querySelector("[role=alert]"), tab.counts, tab.logs.length]).toEqual([["No updates."], null, ["0"], 1]);
  });

  it("rethrows a failure that isn't the window's while it reads", async () => {
    const tab = new Tab();
    const rejection: Promise<unknown> = UnhandledRejections.nextAsync();
    tab.requests.fail(AzureDevOpsNames.readPullRequestUpdatesMethod, new RangeError("Unexpected."));
    await tab.openAsync();

    expect(await rejection).toBeInstanceOf(RangeError);
  });
});
