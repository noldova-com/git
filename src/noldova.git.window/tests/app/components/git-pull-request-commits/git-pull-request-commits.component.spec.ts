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
import { HostPullRequestCommit, HostPullRequestCommits, HostReference } from "@noldova/git.hosting.protocol";
import { describe, expect, it, onTestFinished, vi } from "vitest";

import { GitPullRequestCommitsComponent } from "../../../../src/app/components/git-pull-request-commits/git-pull-request-commits.component.ts";
import { RequestAnswers } from "../../../fixtures/request-answers.fixture.ts";
import { TestPullRequestHost } from "../../../fixtures/test-pull-request-host.fixture.ts";
import { UnhandledRejections } from "../../../fixtures/unhandled-rejections.fixture.ts";
import { WindowFailure } from "../../../fixtures/window-failure.fixture.ts";

const REPOSITORY: string = "3f2504e0-4f89-11d3-9a0c-0305e82c3301";
const URL: string = "https://example.com/fabrikam/site/pulls/482";
const FIRST: string = "9fceb02d0ae598e95dc970b74767f19372d61af8";
const SECOND: string = "0123456789abcdef0123456789abcdef01234567";
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
const reference: HostReference = new HostReference("git-example", "fabrikam", REPOSITORY, 482);
const other: HostReference = new HostReference("git-example", "fabrikam", REPOSITORY, 7);

function commitsOf(count: number): HostPullRequestCommits {
  return new HostPullRequestCommits(Array.from({ length: count }, () => new HostPullRequestCommit(FIRST, "Step", "Mona Lisa", OLD)), count === 250);
}

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
  public fixture: ComponentFixture<GitPullRequestCommitsComponent> | null = null;

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
    this.fixture = TestBed.createComponent(GitPullRequestCommitsComponent);
    this.fixture.componentRef.setInput("host", this.host);
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

  public async clickAsync(selector: string, index: number = 0): Promise<void> {
    const found = this.element.querySelectorAll<HTMLElement>(selector)[index];
    if (found === undefined)
      throw new Error(`Nothing matches ${selector}.`);
    found.click();
    await this.settleAsync();
  }
}

describe("GitPullRequestCommitsComponent", () => {
  it("lists the commits with their short id, subject, author and age, and counts them once read", async () => {
    pinNow();
    const recent: number = NOW - 5 * 60_000;
    const tab = new Tab();
    tab.requests.answer(TestPullRequestHost.commitsMethod, new HostPullRequestCommits([new HostPullRequestCommit(FIRST, "Fix the sign-in", "Mona Lisa", recent),
      new HostPullRequestCommit(SECOND, "", "Hubot", OLD)], false).toJson());
    await tab.openAsync();

    const old: string = new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" }).format(OLD);
    expect([tab.requests.methods, tab.requests.payloads]).toEqual([[TestPullRequestHost.commitsMethod], [reference.toJson()]]);
    expect(tab.texts(".row")).toEqual(["9fceb02 Fix the sign-in Mona Lisa · 5 min", `0123456 Hubot · ${old}`]);
    expect([tab.texts(".cap"), tab.counts]).toEqual([[], ["2"]]);
  });

  it("says when the host has more than the 250 it shows, and when there are none", async () => {
    const full = new Tab();
    full.requests.answer(TestPullRequestHost.commitsMethod, commitsOf(250).toJson());
    await full.openAsync();
    const none = new Tab();
    TestBed.resetTestingModule();
    none.requests.answer(TestPullRequestHost.commitsMethod, commitsOf(0).toJson());
    await none.openAsync();

    expect([full.texts(".cap"), full.counts, none.texts(".empty"), none.counts]).toEqual([["Showing the latest 250."], ["250+"], ["No commits."], ["0"]]);
  });

  it("opens a commit's page on the host when the open repository isn't the pull request's, asking the host with the pull request's page", async () => {
    const tab = new Tab();
    tab.requests.answer(TestPullRequestHost.commitsMethod, commitsOf(1).toJson());
    tab.context.answer("openLinkAsync", async () => undefined);
    await tab.openAsync();

    await tab.clickAsync(".row");

    expect([tab.context.callsOf("openLinkAsync"), tab.context.callsOf("runCommandAsync"), tab.host.asked]).toEqual([[[`${URL}/commits/${FIRST}`]], [], [URL]]);
  });


  it("shows a commit in the Git module's history when the open repository is the pull request's, and logs a history it can't open", async () => {
    const tab = new Tab();
    tab.host.folder = "/work/site";
    tab.requests.answer(TestPullRequestHost.commitsMethod, commitsOf(1).toJson());
    let calls = 0;
    tab.context.answer("runCommandAsync", async () => {
      calls++;
      if (calls === 2)
        throw new WindowFailure("No Git module.");
      return null;
    });
    await tab.openAsync();

    await tab.clickAsync(".row");
    await tab.clickAsync(".row");

    expect([tab.context.callsOf("runCommandAsync"), tab.logs, tab.context.callsOf("openLinkAsync")]).toEqual([
      [["git.openHistory", { folder: "/work/site" }], ["git.openHistory", { folder: "/work/site" }]],
      ["The Example module's git.openHistory request failed: WindowFailure: No Git module."], []]);
  });

  it("logs a commit's page the window can't open", async () => {
    const tab = new Tab();
    tab.requests.answer(TestPullRequestHost.commitsMethod, commitsOf(1).toJson());
    tab.context.answer("openLinkAsync", async () => {
      throw new WindowFailure("No browser.");
    });
    await tab.openAsync();

    await tab.clickAsync(".row");

    expect(tab.logs).toEqual([`The Example module couldn't open ${URL}/commits/${FIRST}: WindowFailure: No browser.`]);
  });

  it("says it is reading until the answer comes", async () => {
    const tab = new Tab();
    const release = tab.requests.hold(TestPullRequestHost.commitsMethod);
    tab.create();
    await tab.requests.askedAsync(1);
    tab.fixture?.detectChanges();

    expect(tab.texts("[role=status]")).toEqual(["Reading the commits on Example."]);
    release(commitsOf(1).toJson());
    await tab.settleAsync();
    expect(tab.texts(".row")).toHaveLength(1);
  });

  it("logs a read the window fails, offers to try again, and shows the commits the retry reads", async () => {
    const tab = new Tab();
    tab.requests.fail(TestPullRequestHost.commitsMethod, new WindowFailure("The runtime stopped."));
    tab.requests.answer(TestPullRequestHost.commitsMethod, commitsOf(1).toJson());
    await tab.openAsync();

    expect([tab.texts("[role=alert]"), tab.logs, tab.counts]).toEqual([["error Example didn't answer. Try again to read the commits. Try again"],
      ["The Example module's git-example.readPullRequestCommits request failed: WindowFailure: The runtime stopped."], []]);
    await tab.clickAsync("[role=alert] button");
    expect([tab.texts(".row"), tab.counts]).toEqual([[`9fceb02 Step Mona Lisa · ${new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" }).format(OLD)}`], ["1"]]);
  });

  it("drops an answer or a failure for a pull request it left", async () => {
    const tab = new Tab();
    const release = tab.requests.hold(TestPullRequestHost.commitsMethod);
    const fail = tab.requests.holdFailure(TestPullRequestHost.commitsMethod);
    tab.requests.answer(TestPullRequestHost.commitsMethod, commitsOf(0).toJson());
    tab.create();
    await tab.requests.askedAsync(1);

    tab.fixture?.componentRef.setInput("reference", other);
    await tab.requests.askedAsync(2);
    tab.fixture?.componentRef.setInput("reference", reference);
    await tab.requests.askedAsync(3);
    release(commitsOf(1).toJson());
    fail(new WindowFailure("The runtime stopped."));
    await Promise.allSettled(tab.requests.answered);
    await tab.settleAsync();

    expect([tab.texts(".empty"), tab.element.querySelector("[role=alert]"), tab.counts, tab.logs.length]).toEqual([["No commits."], null, ["0"], 1]);
  });

  it("rethrows a failure that isn't the window's while it reads or opens a commit", async () => {
    const reading = new Tab();
    const rejection: Promise<unknown> = UnhandledRejections.nextAsync();
    reading.requests.fail(TestPullRequestHost.commitsMethod, new RangeError("Unexpected."));
    await reading.openAsync();
    expect(await rejection).toBeInstanceOf(RangeError);

    TestBed.resetTestingModule();
    const opening = new Tab();
    opening.requests.answer(TestPullRequestHost.commitsMethod, commitsOf(1).toJson());
    opening.context.answer("openLinkAsync", async () => {
      throw new RangeError("Unexpected.");
    });
    await opening.openAsync();
    const opened: Promise<unknown> = UnhandledRejections.nextAsync();
    await opening.clickAsync(".row");
    expect(await opened).toBeInstanceOf(RangeError);
  });

  it("rethrows a failure the host throws while it finds the pull request's repository", async () => {
    const tab = new Tab();
    tab.host.failure = new RangeError("Unexpected.");
    const rejection: Promise<unknown> = UnhandledRejections.nextAsync();
    tab.requests.answer(TestPullRequestHost.commitsMethod, commitsOf(1).toJson());
    await tab.openAsync();

    expect(await rejection).toBeInstanceOf(RangeError);
  });
});
