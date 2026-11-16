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
import { GitHubNames } from "@noldova/git.github.protocol";
import { BranchPullRequest, BranchQuery, CheckState, DeviceCode, HostAccount, HostChanges, HostCheck, HostItem, HostReference, HostSignIn, ReferenceKind,
  ReferenceState } from "@noldova/git.hosting.protocol";
import { GitRemote, RemoteTransport } from "@noldova/git.protocol";
import { ClipboardWriter } from "@noldova/ui.components.angular";
import { ClipboardWriterFixture } from "@noldova/ui.components.angular/testing";
import { describe, expect, it } from "vitest";

import { GitHubHostRowComponent } from "../../../../src/app/components/github-host-row/github-host-row.component.ts";
import { RequestAnswers } from "../../../fixtures/request-answers.fixture.ts";
import { UnhandledRejections } from "../../../fixtures/unhandled-rejections.fixture.ts";
import { WindowFailure } from "../../../fixtures/window-failure.fixture.ts";

const HEAD: string = "0123456789abcdef0123456789abcdef01234567";
const remote: GitRemote = new GitRemote("origin", "github.com", "example-owner/example-repository", RemoteTransport.Https);
const account: HostAccount = new HostAccount("example-user", null, null, ["repo"]);
const code: DeviceCode = new DeviceCode("WDJB-MJHT", "https://github.com/login/device", 1_800_000_872_000);
const signedIn: HostSignIn = HostSignIn.signedIn(account);
const pullRequest: HostItem = new HostItem(new HostReference("git-github", "example-owner", "example-repository", 7), ReferenceKind.PullRequest, ReferenceState.Open,
  "Sample pull request title", "https://github.com/example-owner/example-repository/pull/7", null, 1_800_000_000_000, null, 0, new HostChanges(1, 0, 1, "feature/readme", "main", HEAD));
const runs: string = "https://github.com/example-owner/example-repository/actions/runs/";
const checks: readonly HostCheck[] = [
  new HostCheck("Linux x64", CheckState.Succeeded, `${runs}1`),
  new HostCheck("Lint", CheckState.Neutral, null),
  new HostCheck("macOS arm64", CheckState.Running, `${runs}2`),
  new HostCheck("Pages", CheckState.Queued, `${runs}3`),
  new HostCheck("Windows x64", CheckState.Failed, `${runs}4`)
];
const answer: BranchPullRequest = new BranchPullRequest(pullRequest, checks);
const none: BranchPullRequest = new BranchPullRequest(null, []);

function wordsOf(node: Node): string {
  const words: string[] = [];
  const walker = document.createTreeWalker(node, NodeFilter.SHOW_TEXT);
  for (let text = walker.nextNode(); text !== null; text = walker.nextNode())
    words.push((text.textContent ?? "").trim());
  return words.filter(t => t.length > 0).join(" ").replace(/\s+/g, " ");
}

class Page {
  public readonly context: FakeWindowPartContext = new FakeWindowPartContext();
  public readonly requests: RequestAnswers = new RequestAnswers(this.context);
  public fixture: ComponentFixture<GitHubHostRowComponent> | null = null;

  public get element(): HTMLElement {
    const element = this.fixture?.nativeElement;
    if (!(element instanceof HTMLElement))
      throw new Error("The page isn't open.");
    return element;
  }

  public get clipboard(): string[] {
    const writer = TestBed.inject(ClipboardWriter);
    return writer instanceof ClipboardWriterFixture ? writer.texts : [];
  }

  public refuseClipboard(): void {
    const writer = TestBed.inject(ClipboardWriter);
    if (writer instanceof ClipboardWriterFixture)
      writer.answer = (): Promise<boolean> => Promise.resolve(false);
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
    return this.context.callsOf("openLinkAsync").map(t => t[1] ?? null);
  }

  public async openAsync(first: HostSignIn | null, branch: string | null = "feature/readme", where: GitRemote = remote): Promise<this> {
    this.create(first, branch, where);
    await this.settleAsync();
    return this;
  }

  public create(first: HostSignIn | null, branch: string | null = "feature/readme", where: GitRemote = remote): void {
    if (first !== null)
      this.requests.answer(GitHubNames.readSignInMethod, first.toJson());
    TestBed.configureTestingModule({ providers: [{ provide: WindowPartTokens.context, useValue: this.context }] });
    this.fixture = TestBed.createComponent(GitHubHostRowComponent);
    this.fixture.componentRef.setInput("folder", "/work/example-repository");
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
    if (found === undefined)
      throw new Error(`No button reads ${label}.`);
    found.click();
    await this.settleAsync();
  }

  public async clickElementAsync(selector: string): Promise<void> {
    this.find(selector).click();
    await this.settleAsync();
  }
}

describe("GitHubHostRowComponent", () => {
  it("reads the branch's pull request for the remote's repository, the branch and HEAD, once signed in", async () => {
    const page = new Page();
    page.requests.answer(GitHubNames.readBranchPullRequestMethod, answer.toJson());
    await page.openAsync(signedIn);

    expect(page.requests.methods).toEqual([GitHubNames.readSignInMethod, GitHubNames.readBranchPullRequestMethod]);
    expect(page.requests.payloads).toEqual([null, new BranchQuery("github.com", "example-owner/example-repository", "feature/readme", HEAD).toJson()]);
    expect(page.texts(".title")).toEqual(["#7 Sample pull request title"]);
    expect(page.find(".state").getAttribute("aria-label")).toBe("Open");
  });

  it("lists the checks worst first, each with its state, and failed and passed checks in their colours' classes", async () => {
    const page = new Page();
    page.requests.answer(GitHubNames.readBranchPullRequestMethod, answer.toJson());
    await page.openAsync(signedIn);

    expect(page.texts(".check")).toEqual(["Windows x64 Failed", "macOS arm64 Running", "Pages Queued", "Linux x64 Passed", "Lint Skipped"]);
    expect([...page.element.querySelectorAll(".check")].map(t => [t.classList.contains("failed"), t.classList.contains("ok")]))
      .toEqual([[true, false], [false, false], [false, false], [false, true], [false, false]]);
    expect(page.texts("button.name")).toEqual(["Windows x64", "macOS arm64", "Pages", "Linux x64"]);
    expect(page.texts("span.name")).toEqual(["Lint"]);
  });

  it("opens the pull request from its title and its open button, and a check's run from its name, and says and logs a link that doesn't open", async () => {
    const page = new Page();
    page.requests.answer(GitHubNames.readBranchPullRequestMethod, answer.toJson());
    page.context.answer("openLinkAsync", async () => undefined);
    await page.openAsync(signedIn);

    await page.clickElementAsync(".title");
    await page.clickAsync("Open on GitHub");
    await page.clickElementAsync("button.name");
    page.context.answer("openLinkAsync", async () => {
      throw new WindowFailure("The link was refused.");
    });
    await page.clickElementAsync(".title");

    expect(page.links).toEqual([pullRequest.url, pullRequest.url, `${runs}4`, pullRequest.url]);
    expect(page.places).toEqual([null, null, null, null]);
    expect(page.texts("[role=alert]")).toEqual(["error The page couldn't be opened; the app's log has the details. Open the page again"]);
    expect(page.texts(".title")).toEqual(["#7 Sample pull request title"]);
    expect(page.logs).toEqual([`The GitHub module couldn't open ${pullRequest.url}: WindowFailure: The link was refused.`]);
  });

  it("shows a pull request with no checks without a checks list", async () => {
    const page = new Page();
    page.requests.answer(GitHubNames.readBranchPullRequestMethod, new BranchPullRequest(pullRequest, []).toJson());
    await page.openAsync(signedIn);

    expect([page.texts(".title"), page.element.querySelector(".checks")]).toEqual([["#7 Sample pull request title"], null]);
  });

  it("says the branch has no pull request when GitHub has none", async () => {
    const page = new Page();
    page.requests.answer(GitHubNames.readBranchPullRequestMethod, none.toJson());
    await page.openAsync(signedIn);

    expect(page.text).toBe("No pull request for this branch");
  });

  it("says a detached HEAD has no pull request, without asking", async () => {
    const page = new Page();
    await page.openAsync(signedIn, null);

    expect([page.text, page.requests.methods]).toEqual(["No pull request for this branch", [GitHubNames.readSignInMethod]]);
  });

  it("doesn't ask for a remote with no host or path", async () => {
    const page = new Page();
    await page.openAsync(signedIn, "feature/readme", new GitRemote("origin", null, null, RemoteTransport.Other));

    expect([page.text, page.requests.methods]).toEqual(["No pull request for this branch", [GitHubNames.readSignInMethod]]);
  });

  it("says it is reading until GitHub answers", async () => {
    const page = new Page();
    const release = page.requests.hold(GitHubNames.readBranchPullRequestMethod);
    page.create(signedIn);
    await page.requests.askedAsync(2);
    await page.untilAsync(() => page.text === "Reading this branch's pull request on GitHub.");
    const reading = [page.requests.methods, page.text];
    release(answer.toJson());
    await page.settleAsync();

    expect(reading).toEqual([[GitHubNames.readSignInMethod, GitHubNames.readBranchPullRequestMethod], "Reading this branch's pull request on GitHub."]);
    expect(page.texts(".title")).toEqual(["#7 Sample pull request title"]);
  });

  it("says it is reading while the sign-in is still unknown", async () => {
    const page = new Page();
    const release = page.requests.hold(GitHubNames.readSignInMethod);
    page.create(null);

    await page.requests.askedAsync(1);
    await page.untilAsync(() => page.text === "Reading this branch's pull request on GitHub.");
    release(HostSignIn.signedOut().toJson());
    await page.settleAsync();
    expect(page.text).toContain("Sign in to GitHub to see this branch's pull request and its checks.");
  });

  it("reads again when the branch or HEAD changes, and drops an answer for a branch it has left", async () => {
    const page = new Page();
    const release = page.requests.hold(GitHubNames.readBranchPullRequestMethod);
    page.requests.answer(GitHubNames.readBranchPullRequestMethod, none.toJson(), answer.toJson());
    page.create(signedIn);
    await page.requests.askedAsync(2);
    page.fixture?.componentRef.setInput("branch", "feature/other");
    await page.untilAsync(() => page.text === "No pull request for this branch");
    release(answer.toJson());
    await page.settleAsync();
    const left = page.text;
    await page.setAsync("head", "fedcba9876543210fedcba9876543210fedcba98");

    expect(left).toBe("No pull request for this branch");
    expect(page.requests.payloads.slice(1)).toEqual([
      new BranchQuery("github.com", "example-owner/example-repository", "feature/readme", HEAD).toJson(),
      new BranchQuery("github.com", "example-owner/example-repository", "feature/other", HEAD).toJson(),
      new BranchQuery("github.com", "example-owner/example-repository", "feature/other", "fedcba9876543210fedcba9876543210fedcba98").toJson()
    ]);
    expect(page.texts(".title")).toEqual(["#7 Sample pull request title"]);
  });

  it("asks nothing again and keeps the card for a new but equal remote", async () => {
    const page = new Page();
    page.requests.answer(GitHubNames.readBranchPullRequestMethod, answer.toJson());
    await page.openAsync(signedIn);
    await page.setAsync("remote", new GitRemote("origin", "github.com", "example-owner/example-repository", RemoteTransport.Https));

    expect([page.requests.methods, page.texts(".title")]).toEqual([[GitHubNames.readSignInMethod, GitHubNames.readBranchPullRequestMethod],
      ["#7 Sample pull request title"]]);
  });

  it("asks nothing for a new remote while signed out", async () => {
    const page = new Page();
    await page.openAsync(HostSignIn.signedOut());
    await page.setAsync("remote", new GitRemote("origin", "github.com", "example-owner/example-repository", RemoteTransport.Https));

    expect(page.requests.methods).toEqual([GitHubNames.readSignInMethod]);
  });

  it("keeps the pull request shown, marked busy, while it reads again for a new HEAD", async () => {
    const page = new Page();
    page.requests.answer(GitHubNames.readBranchPullRequestMethod, answer.toJson());
    const release = page.requests.hold(GitHubNames.readBranchPullRequestMethod);
    await page.openAsync(signedIn);
    const shown = page.element.querySelector(".pr")?.getAttribute("aria-busy");
    page.fixture?.componentRef.setInput("head", "fedcba9876543210fedcba9876543210fedcba98");
    await page.requests.askedAsync(3);
    const reading = [page.texts(".title"), page.element.querySelector(".pr")?.getAttribute("aria-busy")];
    release(answer.toJson());
    await page.settleAsync();

    expect([shown, reading, page.element.querySelector(".pr")?.getAttribute("aria-busy")])
      .toEqual([null, [["#7 Sample pull request title"], "true"], null]);
  });

  it("drops the card once a new HEAD reads no pull request", async () => {
    const page = new Page();
    page.requests.answer(GitHubNames.readBranchPullRequestMethod, answer.toJson());
    await page.openAsync(signedIn);
    page.requests.answer(GitHubNames.readBranchPullRequestMethod, none.toJson());
    await page.setAsync("head", "fedcba9876543210fedcba9876543210fedcba98");

    expect(page.text).toEqual("No pull request for this branch");
  });

  it("drops a sign-in answer that a newer sign-in change overtook", async () => {
    const page = new Page();
    const release = page.requests.hold(GitHubNames.readSignInMethod);
    page.requests.answer(GitHubNames.readBranchPullRequestMethod, answer.toJson());
    page.create(null);
    await page.requests.askedAsync(1);
    page.context.raiseEvent(GitHubNames.signInChangedEvent, signedIn.toJson());
    release(HostSignIn.signedOut().toJson());
    await page.settleAsync();

    expect(page.texts(".title")).toEqual(["#7 Sample pull request title"]);
  });

  it("drops a failure for a branch it has left", async () => {
    const page = new Page();
    const reject = page.requests.holdFailure(GitHubNames.readBranchPullRequestMethod);
    page.requests.answer(GitHubNames.readBranchPullRequestMethod, answer.toJson());
    page.create(signedIn);
    await page.requests.askedAsync(2);
    page.fixture?.componentRef.setInput("branch", "feature/other");
    await page.untilAsync(() => page.texts(".title")[0] === "#7 Sample pull request title");
    reject(new WindowFailure("GitHub didn't answer."));
    await page.settleAsync();

    expect([page.element.querySelector("[role=alert]"), page.texts(".title")]).toEqual([null, ["#7 Sample pull request title"]]);
  });

  it("says when GitHub doesn't answer, and reads again on Try again", async () => {
    const page = new Page();
    page.requests.fail(GitHubNames.readBranchPullRequestMethod, new WindowFailure("GitHub didn't answer."));
    page.requests.answer(GitHubNames.readBranchPullRequestMethod, answer.toJson());
    await page.openAsync(signedIn);
    const failed = page.texts("[role=alert]");
    await page.clickAsync("Try again");

    expect(failed).toEqual(["error GitHub didn't answer. Try again to read this branch's pull request. Try again"]);
    expect(page.logs).toEqual([`The GitHub module's ${GitHubNames.readBranchPullRequestMethod} request failed: WindowFailure: GitHub didn't answer.`]);
    expect([page.element.querySelector("[role=alert]"), page.texts(".title")]).toEqual([null, ["#7 Sample pull request title"]]);
  });

  it("says when the sign-in can't be read, and reads it again on Try again", async () => {
    const page = new Page();
    page.requests.fail(GitHubNames.readSignInMethod, new WindowFailure("GitHub didn't answer."));
    await page.openAsync(null);
    const failed = page.element.querySelector("[role=alert]") !== null;
    page.requests.answer(GitHubNames.readSignInMethod, HostSignIn.signedOut().toJson());
    await page.clickAsync("Try again");

    expect([failed, page.element.querySelector("[role=alert]"), page.requests.methods]).toEqual([true, null,
      [GitHubNames.readSignInMethod, GitHubNames.readSignInMethod]]);
    expect(page.logs).toEqual([`The GitHub module's ${GitHubNames.readSignInMethod} request failed: WindowFailure: GitHub didn't answer.`]);
  });

  it.each([
    ["the sign-in's read", GitHubNames.readSignInMethod, null],
    ["the pull request's read", GitHubNames.readBranchPullRequestMethod, signedIn]
  ])("passes on a failure of %s that isn't the window's, rather than saying GitHub didn't answer", async (_, method, first) => {
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
    page.requests.answer(GitHubNames.readBranchPullRequestMethod, answer.toJson());
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

  it("offers to sign in when signed out, copies the code and opens GitHub's page where the Links setting says, copies it again and cancels", async () => {
    const page = new Page();
    page.requests.answer(GitHubNames.startSignInMethod, HostSignIn.waiting(code).toJson());
    page.requests.answer(GitHubNames.cancelSignInMethod, HostSignIn.signedOut().toJson());
    await page.openAsync(HostSignIn.signedOut());
    const onClipboardAtOpen: string[][] = [];
    page.context.answer("openLinkAsync", async () => {
      onClipboardAtOpen.push([...page.clipboard]);
    });
    const signedOut = page.text;
    await page.clickAsync("Sign in to GitHub");
    const waiting = page.text;
    await page.clickAsync("Copy code");
    await page.clickAsync("Cancel");

    expect(signedOut).toBe("Sign in to GitHub to see this branch's pull request and its checks. Sign in to GitHub");
    expect(waiting).toBe("Paste the code WDJB-MJHT on GitHub's page; it's copied. Copy code Cancel");
    expect([page.links, page.clipboard, page.requests.methods]).toEqual([[code.verificationUri], [code.userCode, code.userCode],
      [GitHubNames.readSignInMethod, GitHubNames.startSignInMethod, GitHubNames.cancelSignInMethod]]);
    expect(onClipboardAtOpen).toEqual([[code.userCode]]);
    expect(page.places).toEqual([null]);
    expect(page.text).toContain("Sign in to GitHub to see this branch's pull request and its checks.");
  });

  it("says a code is copied only while it is the code the clipboard took, not for a newer one started elsewhere", async () => {
    const page = new Page();
    page.requests.answer(GitHubNames.startSignInMethod, HostSignIn.waiting(code).toJson());
    page.context.answer("openLinkAsync", async () => undefined);
    await page.openAsync(HostSignIn.signedOut());
    await page.clickAsync("Sign in to GitHub");
    const copied = page.text;

    const other = new DeviceCode("QXRT-PLMN", code.verificationUri, code.expiresAt);
    page.context.raiseEvent(GitHubNames.signInChangedEvent, HostSignIn.waiting(other).toJson());
    await page.settleAsync();

    expect([copied, page.text]).toEqual(["Paste the code WDJB-MJHT on GitHub's page; it's copied. Copy code Cancel",
      "Enter QXRT-PLMN on GitHub to sign in. Copy code Cancel"]);
  });

  it("still opens GitHub's page when the clipboard refuses the code, and asks the person to enter it instead of saying it's copied", async () => {
    const page = new Page();
    page.requests.answer(GitHubNames.startSignInMethod, HostSignIn.waiting(code).toJson());
    page.context.answer("openLinkAsync", async () => undefined);
    await page.openAsync(HostSignIn.signedOut());
    page.refuseClipboard();

    await page.clickAsync("Sign in to GitHub");

    expect([page.text, page.links, page.clipboard]).toEqual(["Enter WDJB-MJHT on GitHub to sign in. Copy code Cancel", [code.verificationUri],
      [code.userCode]]);
  });

  it("keeps the code shown and copyable when GitHub's page can't open, and opens the page again from the failure's notice", async () => {
    const page = new Page();
    page.requests.answer(GitHubNames.startSignInMethod, HostSignIn.waiting(code).toJson());
    await page.openAsync(HostSignIn.signedOut());
    page.context.answer("openLinkAsync", async () => {
      throw new WindowFailure("No browser.");
    });
    await page.clickAsync("Sign in to GitHub");
    const failed = page.texts(".notice");
    page.context.answer("openLinkAsync", async () => undefined);
    await page.clickAsync("Open the page again");

    expect(failed).toEqual([
      "Paste the code WDJB-MJHT on GitHub's page; it's copied. Copy code Cancel",
      "error The page couldn't be opened; the app's log has the details. Open the page again"
    ]);
    expect([page.links, page.element.querySelector("[role=alert]"), page.texts(".notice")])
      .toEqual([[code.verificationUri, code.verificationUri], null, ["Paste the code WDJB-MJHT on GitHub's page; it's copied. Copy code Cancel"]]);
    expect(page.logs).toEqual([`The GitHub module couldn't open ${code.verificationUri}: WindowFailure: No browser.`]);
  });

  it("says and logs a sign-in that doesn't start, and offers the sign-in again on Try again", async () => {
    const page = new Page();
    page.requests.fail(GitHubNames.startSignInMethod, new WindowFailure("GitHub didn't answer."));
    await page.openAsync(HostSignIn.signedOut());
    await page.clickAsync("Sign in to GitHub");
    const failed = page.texts("[role=alert]");
    await page.clickAsync("Try again");

    expect(failed).toEqual(["error GitHub's sign-in didn't answer. Try again. Try again"]);
    expect(page.logs).toEqual([`The GitHub module's ${GitHubNames.startSignInMethod} request failed: WindowFailure: GitHub didn't answer.`]);
    expect([page.links, page.element.querySelector("[role=alert]"), page.text])
      .toEqual([[], null, "Sign in to GitHub to see this branch's pull request and its checks. Sign in to GitHub"]);
  });

  it("drops the notice of GitHub's page that didn't open once the sign-in finishes", async () => {
    const page = new Page();
    page.requests.answer(GitHubNames.startSignInMethod, HostSignIn.waiting(code).toJson());
    page.requests.answer(GitHubNames.readBranchPullRequestMethod, answer.toJson());
    await page.openAsync(HostSignIn.signedOut());
    page.context.answer("openLinkAsync", async () => {
      throw new WindowFailure("No browser.");
    });
    await page.clickAsync("Sign in to GitHub");
    const failed = page.texts("[role=alert]");
    page.context.raiseEvent(GitHubNames.signInChangedEvent, signedIn.toJson());
    await page.settleAsync();

    expect(failed).toEqual(["error The page couldn't be opened; the app's log has the details. Open the page again"]);
    expect([page.element.querySelector("[role=alert]"), page.texts(".title")]).toEqual([null, ["#7 Sample pull request title"]]);
  });

  it("drops a failure notice once the sign-in changes, and shows the new sign-in", async () => {
    const page = new Page();
    page.requests.fail(GitHubNames.startSignInMethod, new WindowFailure("GitHub didn't answer."));
    page.requests.answer(GitHubNames.readBranchPullRequestMethod, answer.toJson());
    await page.openAsync(HostSignIn.signedOut());
    await page.clickAsync("Sign in to GitHub");
    const failed = page.texts("[role=alert]");
    page.context.raiseEvent(GitHubNames.signInChangedEvent, signedIn.toJson());
    await page.settleAsync();

    expect(failed).toEqual(["error GitHub's sign-in didn't answer. Try again. Try again"]);
    expect([page.element.querySelector("[role=alert]"), page.texts(".title")]).toEqual([null, ["#7 Sample pull request title"]]);
  });

  it("reads the pull request once the sign-in finishes, and stops following the sign-in when it goes", async () => {
    const page = new Page();
    page.requests.answer(GitHubNames.readBranchPullRequestMethod, answer.toJson());
    await page.openAsync(HostSignIn.signedOut());
    page.context.raiseEvent(GitHubNames.signInChangedEvent, signedIn.toJson());
    await page.settleAsync();
    const shown = page.texts(".title");
    page.fixture?.destroy();

    expect([shown, page.context.activeCallsOf("onEvent").filter(t => t[0] === GitHubNames.signInChangedEvent).length]).toEqual([["#7 Sample pull request title"], 0]);
  });
});
