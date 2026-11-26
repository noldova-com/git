/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { type ComponentFixture, TestBed } from "@angular/core/testing";
import "@noldova/context.core";
import { LinkPlace, WindowPartTokens } from "@noldova/desktop.window";
import { FakeWindowPartContext } from "@noldova/desktop.window/testing";
import { AzureDevOpsNames } from "@noldova/git.azure-devops.protocol";
import { BranchPullRequest, BranchQuery, CheckState, HostAccount, HostChanges, HostCheck, HostItem, HostReference, HostSignIn, ReferenceKind,
  ReferenceState, SignInFailure } from "@noldova/git.hosting.protocol";
import { GitRemote, RemoteTransport } from "@noldova/git.protocol";
import { describe, expect, it } from "vitest";

import { AzureDevOpsHostRowComponent } from "../../../../src/app/components/azure-devops-host-row/azure-devops-host-row.component.ts";
import { RequestAnswers } from "../../../fixtures/request-answers.fixture.ts";
import { UnhandledRejections } from "../../../fixtures/unhandled-rejections.fixture.ts";
import { WindowFailure } from "../../../fixtures/window-failure.fixture.ts";

interface IStateLook {
  readonly state: ReferenceState;
  readonly label: string;
  readonly icon: string;
  readonly closedAt: number | null;
}

const HEAD: string = "0123456789abcdef0123456789abcdef01234567";
const OTHER_HEAD: string = "fedcba9876543210fedcba9876543210fedcba98";
const REPOSITORY: string = "3f2504e0-4f89-11d3-9a0c-0305e82c3301";
const remote: GitRemote = new GitRemote("origin", "dev.azure.com", "fabrikam/web/_git/site", RemoteTransport.Https);
const signedIn: HostSignIn = HostSignIn.signedIn(new HostAccount("monalisa@example.com", "Mona Lisa", null, []));
const pullRequest: HostItem = new HostItem(new HostReference("git-azure-devops", "fabrikam", REPOSITORY, 7), ReferenceKind.PullRequest, ReferenceState.Open,
  "Sample pull request title", "https://dev.azure.com/fabrikam/web/_git/site/pullrequest/7", null, 1_800_000_000_000, null, 0,
  HostChanges.uncounted("feature/readme", "main", HEAD));
const builds: string = "https://dev.azure.com/fabrikam/web/_build/results?buildId=";
const checks: readonly HostCheck[] = [
  new HostCheck("Linux x64", CheckState.Succeeded, `${builds}1`),
  new HostCheck("Work items linked", CheckState.Neutral, null),
  new HostCheck("macOS arm64", CheckState.Running, `${builds}2`),
  new HostCheck("Pages", CheckState.Queued, `${builds}3`),
  new HostCheck("Minimum number of reviewers", CheckState.Failed, null)
];
const answer: BranchPullRequest = new BranchPullRequest(pullRequest, checks);
const none: BranchPullRequest = new BranchPullRequest(null, []);
const looks: readonly IStateLook[] = [
  { state: ReferenceState.Open, label: "Active", icon: "merge", closedAt: null },
  { state: ReferenceState.Draft, label: "Draft", icon: "draft", closedAt: null },
  { state: ReferenceState.Merged, label: "Completed", icon: "check_circle", closedAt: 1_800_000_360_000 },
  { state: ReferenceState.Closed, label: "Abandoned", icon: "block", closedAt: 1_800_000_360_000 }
];
const boardsText: string = " My work items";
const signedOutText: string = "key Sign in in Settings → Accounts and hosts to see this branch's pull request and its checks." + boardsText;
const bareNoneText: string = "merge No pull request for this branch";
const noneText: string = bareNoneText + boardsText;
const readingText: string = "Reading this branch's pull request on Azure DevOps." + boardsText;

function wordsOf(node: Node): string {
  const words: string[] = [];
  const walker = document.createTreeWalker(node, NodeFilter.SHOW_TEXT);
  for (let text = walker.nextNode(); !Object.isNull(text); text = walker.nextNode())
    words.push((text.textContent ?? "").trim());
  return words.filter(t => t.length > 0).join(" ").replace(/\s+/g, " ");
}

class Page {
  public readonly context: FakeWindowPartContext = new FakeWindowPartContext();
  public readonly browser = { placeFor: (): LinkPlace => LinkPlace.InApp, openAsync: (): Promise<void> => Promise.resolve() };
  public readonly requests: RequestAnswers = new RequestAnswers(this.context);
  public fixture: ComponentFixture<AzureDevOpsHostRowComponent> | null = null;

  public get element(): HTMLElement {
    const element = this.fixture?.nativeElement;
    if (!(element instanceof HTMLElement))
      throw new Error("The page isn't open.");
    return element;
  }

  public get text(): string {
    return wordsOf(this.element);
  }

  public get logs(): readonly unknown[] {
    return this.context.callsOf("log").map(t => t[0]);
  }

  public get links(): readonly unknown[] {
    return this.context.callsOf("openLinkAsync").map(t => t[0]);
  }

  public get places(): readonly unknown[] {
    return this.context.callsOf("openLinkAsync").map(t => {
      const options = t[1];
      return Object.isObject(options) && "place" in options ? options.place : this.browser.placeFor();
    });
  }

  public registerInAppBrowser(): void {
    this.context.registerInAppBrowser(this.browser);
  }

  public async openAsync(first: HostSignIn | null, branch: string | null = "feature/readme", where: GitRemote = remote): Promise<this> {
    this.create(first, branch, where);
    await this.settleAsync();
    return this;
  }

  public create(first: HostSignIn | null, branch: string | null = "feature/readme", where: GitRemote = remote): void {
    if (!Object.isNull(first))
      this.requests.answer(AzureDevOpsNames.readSignInMethod, first.toJson());
    TestBed.configureTestingModule({ providers: [{ provide: WindowPartTokens.context, useValue: this.context }] });
    this.fixture = TestBed.createComponent(AzureDevOpsHostRowComponent);
    this.fixture.componentRef.setInput("folder", "/work/site");
    this.fixture.componentRef.setInput("branch", branch);
    this.fixture.componentRef.setInput("head", HEAD);
    this.fixture.componentRef.setInput("remote", where);
    this.fixture.autoDetectChanges();
  }

  public untilAsync(done: () => boolean): Promise<void> {
    if (done())
      return Promise.resolve();
    return new Promise(resolve => {
      const observer: MutationObserver = new MutationObserver(() => {
        if (!done())
          return;
        observer.disconnect();
        resolve();
      });
      observer.observe(document.body, { attributes: true, characterData: true, childList: true, subtree: true });
    });
  }

  public async settleAsync(): Promise<void> {
    await this.fixture?.whenStable();
    this.fixture?.detectChanges();
    await this.fixture?.whenStable();
  }

  public async setAsync(name: string, value: unknown): Promise<void> {
    this.fixture?.componentRef.setInput(name, value);
    await this.settleAsync();
  }

  public texts(selector: string): string[] {
    return [...this.element.querySelectorAll(selector)].map(wordsOf);
  }

  public find(selector: string): HTMLElement {
    const found = this.element.querySelector(selector);
    if (!(found instanceof HTMLElement))
      throw new Error(`Nothing matches ${selector}.`);
    return found;
  }

  public async clickAsync(label: string): Promise<void> {
    const found = [...this.element.querySelectorAll("button")].find(t => (t.textContent ?? "").includes(label) || t.getAttribute("aria-label") === label);
    if (Object.isUndefined(found))
      throw new Error(`No button reads ${label}.`);
    found.click();
    await this.settleAsync();
  }

  public async clickElementAsync(selector: string): Promise<void> {
    this.find(selector).click();
    await this.settleAsync();
  }
}

describe("AzureDevOpsHostRowComponent", () => {
  it("reads the branch's pull request for the remote's repository, the branch and HEAD, once signed in", async () => {
    const page = new Page();
    page.requests.answer(AzureDevOpsNames.readBranchPullRequestMethod, answer.toJson());
    await page.openAsync(signedIn);

    expect(page.requests.methods).toEqual([AzureDevOpsNames.readSignInMethod, AzureDevOpsNames.readBranchPullRequestMethod]);
    expect(page.requests.payloads).toEqual([null, new BranchQuery("dev.azure.com", "fabrikam/web/_git/site", "feature/readme", HEAD).toJson()]);
    expect(page.texts(".title")).toEqual(["!7 Sample pull request title"]);
    expect([page.find(".state").getAttribute("aria-label"), page.find(".state").textContent?.trim()]).toEqual(["Active", "merge"]);
  });

  it.each([
    ["decoded", new GitRemote("origin", "dev.azure.com", "fabrikam/Sample Project/_git/site", RemoteTransport.Https), "dev.azure.com", "fabrikam/Sample%20Project/_git/site"],
    ["encoded", new GitRemote("origin", "ssh.dev.azure.com", "v3/fabrikam/Sample%20Project/site", RemoteTransport.Ssh), "ssh.dev.azure.com",
      "v3/fabrikam/Sample%20Project/site"]
  ])("reads the pull request of a repository whose project's name has a space, from a remote that gives it %s", async (_kind, where, host, path) => {
    const page = new Page();
    page.requests.answer(AzureDevOpsNames.readBranchPullRequestMethod, answer.toJson());
    await page.openAsync(signedIn, "feature/readme", where);

    expect(page.requests.payloads).toEqual([null, new BranchQuery(host, path, "feature/readme", HEAD).toJson()]);
    expect(page.texts(".title")).toEqual(["!7 Sample pull request title"]);
  });

  it.each(looks)("names a pull request in the $state state with Azure DevOps' label and its icon", async ({ state, label, icon, closedAt }) => {
    const page = new Page();
    const item = new HostItem(pullRequest.reference, ReferenceKind.PullRequest, state, pullRequest.title, pullRequest.url, null, pullRequest.createdAt, closedAt, 0,
      pullRequest.changes);
    page.requests.answer(AzureDevOpsNames.readBranchPullRequestMethod, new BranchPullRequest(item, []).toJson());
    await page.openAsync(signedIn);

    expect([page.find(".state").getAttribute("aria-label"), page.find(".state").textContent?.trim()]).toEqual([label, icon]);
  });

  it("lists the builds and policies worst first, each with its state and icon, and failed and passed ones in their colours' classes", async () => {
    const page = new Page();
    page.requests.answer(AzureDevOpsNames.readBranchPullRequestMethod, answer.toJson());
    await page.openAsync(signedIn);

    expect(page.texts(".check")).toEqual(["cancel Minimum number of reviewers Failed", "progress_activity macOS arm64 Running", "schedule Pages Queued",
      "check_circle Linux x64 Passed", "do_not_disturb_on Work items linked Neutral"]);
    expect([...page.element.querySelectorAll(".check")].map(t => [t.classList.contains("failed"), t.classList.contains("ok")]))
      .toEqual([[true, false], [false, false], [false, false], [false, true], [false, false]]);
    expect(page.texts("button.name")).toEqual(["macOS arm64", "Pages", "Linux x64"]);
    expect(page.texts("span.name")).toEqual(["Minimum number of reviewers", "Work items linked"]);
  });

  it("opens the pull request from its title and its open button, and a build from its name, where the Links setting says, and says, logs and opens again a link that doesn't open", async () => {
    const page = new Page();
    page.registerInAppBrowser();
    page.requests.answer(AzureDevOpsNames.readBranchPullRequestMethod, answer.toJson());
    page.context.answer("openLinkAsync", async () => undefined);
    await page.openAsync(signedIn);

    await page.clickElementAsync(".title");
    await page.clickAsync("Open in Azure DevOps");
    await page.clickElementAsync("button.name");
    page.context.answer("openLinkAsync", async () => {
      throw new WindowFailure("The link was refused.");
    });
    await page.clickElementAsync(".title");
    const failed = page.texts("[role=alert]");
    page.context.answer("openLinkAsync", async () => undefined);
    await page.clickAsync("Open the page again");

    expect(page.links).toEqual([pullRequest.url, pullRequest.url, `${builds}2`, pullRequest.url, pullRequest.url]);
    expect(page.places).toEqual([LinkPlace.InApp, LinkPlace.InApp, LinkPlace.InApp, LinkPlace.InApp, LinkPlace.InApp]);
    expect(failed).toEqual(["error The page couldn't be opened; the app's log has the details. Open the page again"]);
    expect([page.element.querySelector("[role=alert]"), page.texts(".title")]).toEqual([null, ["!7 Sample pull request title"]]);
    expect(page.logs).toEqual([`The Azure DevOps module couldn't open ${pullRequest.url}: WindowFailure: The link was refused.`]);
  });

  it("shows a pull request with no checks without a checks list", async () => {
    const page = new Page();
    page.requests.answer(AzureDevOpsNames.readBranchPullRequestMethod, new BranchPullRequest(pullRequest, []).toJson());
    await page.openAsync(signedIn);

    expect([page.texts(".title"), page.element.querySelector(".checks")]).toEqual([["!7 Sample pull request title"], null]);
  });

  it("says the branch has no pull request when Azure DevOps has none", async () => {
    const page = new Page();
    page.requests.answer(AzureDevOpsNames.readBranchPullRequestMethod, none.toJson());
    await page.openAsync(signedIn);

    expect(page.text).toBe(noneText);
  });

  it("says a detached HEAD has no pull request, without asking", async () => {
    const page = new Page();
    await page.openAsync(signedIn, null);

    expect([page.text, page.requests.methods]).toEqual([noneText, [AzureDevOpsNames.readSignInMethod]]);
  });

  it("doesn't ask for a remote with no host or path", async () => {
    const page = new Page();
    await page.openAsync(signedIn, "feature/readme", new GitRemote("origin", null, null, RemoteTransport.Other));

    expect([page.text, page.requests.methods]).toEqual([bareNoneText, [AzureDevOpsNames.readSignInMethod]]);
  });

  it("says to sign in in Settings when signed out, offers no button but the project's boards and asks nothing more", async () => {
    const page = new Page();
    await page.openAsync(HostSignIn.signedOut(SignInFailure.Revoked));

    expect([page.text, page.element.querySelectorAll("button:not(.board)").length, page.requests.methods]).toEqual([signedOutText, 0,
      [AzureDevOpsNames.readSignInMethod]]);
  });

  it("says it is reading until Azure DevOps answers", async () => {
    const page = new Page();
    const release = page.requests.hold(AzureDevOpsNames.readBranchPullRequestMethod);
    page.create(signedIn);
    await page.requests.askedAsync(2);
    await page.untilAsync(() => page.text === readingText);
    const reading = [page.requests.methods, page.text, page.find(".notice").getAttribute("aria-busy")];
    release(answer.toJson());
    await page.settleAsync();

    expect(reading).toEqual([[AzureDevOpsNames.readSignInMethod, AzureDevOpsNames.readBranchPullRequestMethod], readingText, "true"]);
    expect(page.texts(".title")).toEqual(["!7 Sample pull request title"]);
  });

  it("says it is reading while the sign-in is still unknown", async () => {
    const page = new Page();
    const release = page.requests.hold(AzureDevOpsNames.readSignInMethod);
    page.create(null);

    await page.requests.askedAsync(1);
    await page.untilAsync(() => page.text === readingText);
    release(HostSignIn.signedOut().toJson());
    await page.settleAsync();
    expect(page.text).toBe(signedOutText);
  });

  it("reads again when the branch or HEAD changes, and drops an answer for a branch it has left", async () => {
    const page = new Page();
    const release = page.requests.hold(AzureDevOpsNames.readBranchPullRequestMethod);
    page.requests.answer(AzureDevOpsNames.readBranchPullRequestMethod, none.toJson(), answer.toJson());
    page.create(signedIn);
    await page.requests.askedAsync(2);
    page.fixture?.componentRef.setInput("branch", "feature/other");
    await page.untilAsync(() => page.text === noneText);
    release(answer.toJson());
    await page.settleAsync();
    const left = page.text;
    await page.setAsync("head", OTHER_HEAD);

    expect(left).toBe(noneText);
    expect(page.requests.payloads.slice(1)).toEqual([
      new BranchQuery("dev.azure.com", "fabrikam/web/_git/site", "feature/readme", HEAD).toJson(),
      new BranchQuery("dev.azure.com", "fabrikam/web/_git/site", "feature/other", HEAD).toJson(),
      new BranchQuery("dev.azure.com", "fabrikam/web/_git/site", "feature/other", OTHER_HEAD).toJson()
    ]);
    expect(page.texts(".title")).toEqual(["!7 Sample pull request title"]);
  });

  it("asks nothing again and keeps the card for a new but equal remote", async () => {
    const page = new Page();
    page.requests.answer(AzureDevOpsNames.readBranchPullRequestMethod, answer.toJson());
    await page.openAsync(signedIn);
    await page.setAsync("remote", new GitRemote("origin", "dev.azure.com", "fabrikam/web/_git/site", RemoteTransport.Https));

    expect([page.requests.methods, page.texts(".title")]).toEqual([[AzureDevOpsNames.readSignInMethod, AzureDevOpsNames.readBranchPullRequestMethod],
      ["!7 Sample pull request title"]]);
  });

  it("opens the remote's project's work items from the line under the row, signed in or out, and shows no line for a remote naming no project",
    async () => {
    const page = new Page();
    await page.openAsync(HostSignIn.signedOut(), "feature/readme", new GitRemote("origin", "dev.azure.com", "fabrikam/Sample%20Project/_git/site",
      RemoteTransport.Https));

    expect([page.texts(".boards .board"), page.find(".boards").getAttribute("aria-label")]).toEqual([["My work items"], "The project's boards"]);
    page.find(".board").click();
    expect(page.context.callsOf("openDocument")).toEqual([["git-azure-devops.workItems", "fabrikam/Sample%20Project", "My work items"]]);
    await page.setAsync("remote", new GitRemote("origin", null, null, RemoteTransport.Other));
    expect(page.element.querySelector(".boards")).toBeNull();
  });

  it("asks nothing for a new remote while signed out", async () => {
    const page = new Page();
    await page.openAsync(HostSignIn.signedOut());
    await page.setAsync("remote", new GitRemote("origin", "fabrikam.visualstudio.com", "web/_git/site", RemoteTransport.Https));

    expect(page.requests.methods).toEqual([AzureDevOpsNames.readSignInMethod]);
  });

  it("keeps the pull request shown, marked busy, while it reads again for a new HEAD", async () => {
    const page = new Page();
    page.requests.answer(AzureDevOpsNames.readBranchPullRequestMethod, answer.toJson());
    const release = page.requests.hold(AzureDevOpsNames.readBranchPullRequestMethod);
    await page.openAsync(signedIn);
    const shown = page.element.querySelector(".pr")?.getAttribute("aria-busy");
    page.fixture?.componentRef.setInput("head", OTHER_HEAD);
    await page.requests.askedAsync(3);
    await page.untilAsync(() => page.element.querySelector(".pr")?.getAttribute("aria-busy") === "true");
    const reading = page.texts(".title");
    release(answer.toJson());
    await page.settleAsync();

    expect([shown, reading, page.element.querySelector(".pr")?.getAttribute("aria-busy")]).toEqual([null, ["!7 Sample pull request title"], null]);
  });

  it("drops the card once a new HEAD reads no pull request", async () => {
    const page = new Page();
    page.requests.answer(AzureDevOpsNames.readBranchPullRequestMethod, answer.toJson());
    await page.openAsync(signedIn);
    page.requests.answer(AzureDevOpsNames.readBranchPullRequestMethod, none.toJson());
    await page.setAsync("head", OTHER_HEAD);

    expect(page.text).toBe(noneText);
  });

  it("drops a sign-in answer that a newer sign-in change overtook", async () => {
    const page = new Page();
    const release = page.requests.hold(AzureDevOpsNames.readSignInMethod);
    page.requests.answer(AzureDevOpsNames.readBranchPullRequestMethod, answer.toJson());
    page.create(null);
    await page.requests.askedAsync(1);
    page.context.raiseEvent(AzureDevOpsNames.signInChangedEvent, signedIn.toJson());
    release(HostSignIn.signedOut().toJson());
    await page.settleAsync();

    expect(page.texts(".title")).toEqual(["!7 Sample pull request title"]);
  });

  it("drops a failure for a branch it has left", async () => {
    const page = new Page();
    const reject = page.requests.holdFailure(AzureDevOpsNames.readBranchPullRequestMethod);
    page.requests.answer(AzureDevOpsNames.readBranchPullRequestMethod, answer.toJson());
    page.create(signedIn);
    await page.requests.askedAsync(2);
    page.fixture?.componentRef.setInput("branch", "feature/other");
    await page.untilAsync(() => page.texts(".title")[0] === "!7 Sample pull request title");
    reject(new WindowFailure("Azure DevOps didn't answer."));
    await page.settleAsync();

    expect([page.element.querySelector("[role=alert]"), page.texts(".title")]).toEqual([null, ["!7 Sample pull request title"]]);
  });

  it("says when Azure DevOps doesn't answer, and reads again on Try again", async () => {
    const page = new Page();
    page.requests.fail(AzureDevOpsNames.readBranchPullRequestMethod, new WindowFailure("Azure DevOps didn't answer."));
    page.requests.answer(AzureDevOpsNames.readBranchPullRequestMethod, answer.toJson());
    await page.openAsync(signedIn);
    const failed = page.texts("[role=alert]");
    await page.clickAsync("Try again");

    expect(failed).toEqual(["error Azure DevOps didn't answer. Try again to read this branch's pull request. Try again"]);
    expect(page.logs).toEqual([`The Azure DevOps module's ${AzureDevOpsNames.readBranchPullRequestMethod} request failed: WindowFailure: Azure DevOps didn't answer.`]);
    expect([page.element.querySelector("[role=alert]"), page.texts(".title")]).toEqual([null, ["!7 Sample pull request title"]]);
  });

  it("says when the sign-in can't be read, and reads it again on Try again", async () => {
    const page = new Page();
    page.requests.fail(AzureDevOpsNames.readSignInMethod, new WindowFailure("Azure DevOps didn't answer."));
    await page.openAsync(null);
    const failed = page.texts("[role=alert]");
    page.requests.answer(AzureDevOpsNames.readSignInMethod, HostSignIn.signedOut().toJson());
    await page.clickAsync("Try again");

    expect(failed).toEqual(["error Azure DevOps' sign-in didn't answer. Try again. Try again"]);
    expect([page.element.querySelector("[role=alert]"), page.text, page.requests.methods]).toEqual([null, signedOutText,
      [AzureDevOpsNames.readSignInMethod, AzureDevOpsNames.readSignInMethod]]);
    expect(page.logs).toEqual([`The Azure DevOps module's ${AzureDevOpsNames.readSignInMethod} request failed: WindowFailure: Azure DevOps didn't answer.`]);
  });

  it.each([
    ["the sign-in's read", AzureDevOpsNames.readSignInMethod, null],
    ["the pull request's read", AzureDevOpsNames.readBranchPullRequestMethod, signedIn]
  ])("passes on a failure of %s that isn't the window's, rather than saying Azure DevOps didn't answer", async (_, method, first) => {
    const page = new Page();
    const unexpected = new TypeError("Unexpected.");
    page.requests.fail(method, unexpected);
    const rejected = UnhandledRejections.nextAsync();
    await page.openAsync(first);

    expect(await rejected).toBe(unexpected);
    expect([page.logs, page.element.querySelector("[role=alert]")]).toEqual([[], null]);
  });

  it("passes on a failure to open the pull request that isn't the window's, rather than saying the page couldn't be opened", async () => {
    const page = new Page();
    page.requests.answer(AzureDevOpsNames.readBranchPullRequestMethod, answer.toJson());
    await page.openAsync(signedIn);
    const unexpected = new TypeError("Unexpected.");
    page.context.answer("openLinkAsync", async () => {
      throw unexpected;
    });
    const rejected = UnhandledRejections.nextAsync();
    await page.clickElementAsync(".title");

    expect(await rejected).toBe(unexpected);
    expect([page.logs, page.element.querySelector("[role=alert]")]).toEqual([[], null]);
  });

  it("drops the notice of a page that didn't open once the sign-in's state changes, and keeps it for a change in the same state", async () => {
    const page = new Page();
    page.requests.answer(AzureDevOpsNames.readBranchPullRequestMethod, answer.toJson());
    await page.openAsync(signedIn);
    page.context.answer("openLinkAsync", async () => {
      throw new WindowFailure("No browser.");
    });
    await page.clickElementAsync(".title");
    page.context.raiseEvent(AzureDevOpsNames.signInChangedEvent, signedIn.toJson());
    await page.settleAsync();
    const kept = page.texts("[role=alert]");
    page.context.raiseEvent(AzureDevOpsNames.signInChangedEvent, HostSignIn.signedOut(SignInFailure.Revoked).toJson());
    await page.settleAsync();

    expect(kept).toEqual(["error The page couldn't be opened; the app's log has the details. Open the page again"]);
    expect([page.element.querySelector("[role=alert]"), page.text]).toEqual([null, signedOutText]);
  });

  it("drops a failure notice once the sign-in changes, and reads the pull request of the new sign-in", async () => {
    const page = new Page();
    page.requests.fail(AzureDevOpsNames.readSignInMethod, new WindowFailure("Azure DevOps didn't answer."));
    page.requests.answer(AzureDevOpsNames.readBranchPullRequestMethod, answer.toJson());
    await page.openAsync(null);
    const failed = page.texts("[role=alert]");
    page.context.raiseEvent(AzureDevOpsNames.signInChangedEvent, signedIn.toJson());
    await page.settleAsync();

    expect(failed).toEqual(["error Azure DevOps' sign-in didn't answer. Try again. Try again"]);
    expect([page.element.querySelector("[role=alert]"), page.texts(".title")]).toEqual([null, ["!7 Sample pull request title"]]);
  });

  it("reads the pull request once signed in, shows the signed-out notice again on a sign-out, and stops following the sign-in when it goes", async () => {
    const page = new Page();
    page.requests.answer(AzureDevOpsNames.readBranchPullRequestMethod, answer.toJson());
    await page.openAsync(HostSignIn.signedOut());
    page.context.raiseEvent(AzureDevOpsNames.signInChangedEvent, signedIn.toJson());
    await page.settleAsync();
    const shown = page.texts(".title");
    page.context.raiseEvent(AzureDevOpsNames.signInChangedEvent, HostSignIn.signedOut().toJson());
    await page.settleAsync();
    const signedOut = page.text;
    page.fixture?.destroy();

    expect([shown, signedOut, page.context.activeCallsOf("onEvent").filter(t => t[0] === AzureDevOpsNames.signInChangedEvent).length])
      .toEqual([["!7 Sample pull request title"], signedOutText, 0]);
    expect(page.requests.methods).toEqual([AzureDevOpsNames.readSignInMethod, AzureDevOpsNames.readBranchPullRequestMethod]);
  });
});
