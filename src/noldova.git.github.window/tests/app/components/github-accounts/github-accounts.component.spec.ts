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
import { GitHubNames } from "@noldova/git.github.protocol";
import { AccountQuery, DeviceCode, HostAccount, HostAccountEntry, HostAccountList, HostSignIn } from "@noldova/git.hosting.protocol";
import { GitHostAccounts } from "@noldova/git.window";
import { describe, expect, it } from "vitest";

import { GitHubAccountsComponent } from "../../../../src/app/components/github-accounts/github-accounts.component.ts";
import { RequestAnswers } from "../../../fixtures/request-answers.fixture.ts";
import { UnhandledRejections } from "../../../fixtures/unhandled-rejections.fixture.ts";
import { WindowFailure } from "../../../fixtures/window-failure.fixture.ts";

const code: DeviceCode = new DeviceCode("WDJB-MJHT", "https://github.com/login/device", 1_800_000_000_000);
const kim: HostSignIn = HostSignIn.signedIn(new HostAccount("kim", null, null, ["repo"]));
const lee: HostSignIn = HostSignIn.signedIn(new HostAccount("lee", null, null, ["repo"]));

function listOf(...signIns: HostSignIn[]): HostAccountList {
  return new HostAccountList(signIns.map((t, i) => new HostAccountEntry(i + 1, t)));
}

class Page {
  public readonly context: FakeWindowPartContext = new FakeWindowPartContext();
  public readonly requests: RequestAnswers = new RequestAnswers(this.context);
  public fixture: ComponentFixture<GitHubAccountsComponent> | null = null;

  public get element(): HTMLElement {
    const element = this.fixture?.nativeElement;
    if (!(element instanceof HTMLElement))
      throw new Error("The page isn't open.");
    return element;
  }

  public get logs(): readonly unknown[] {
    return this.context.callsOf("log").map(t => t[0]);
  }

  public async openAsync(chosen: string | null = null): Promise<this> {
    TestBed.configureTestingModule({ providers: [{ provide: WindowPartTokens.context, useValue: this.context },
      { provide: GitHostAccounts.chosenAccount, useValue: chosen }] });
    this.fixture = TestBed.createComponent(GitHubAccountsComponent);
    await this.settleAsync();
    return this;
  }

  public async settleAsync(): Promise<void> {
    await this.fixture?.whenStable();
    this.fixture?.detectChanges();
    await this.fixture?.whenStable();
  }

  public texts(selector: string): string[] {
    return [...this.element.querySelectorAll(selector)].map(t => (t.textContent ?? "").replace(/\s+/g, " ").trim());
  }

  public readsOf(): readonly unknown[] {
    return this.context.callsOf("requestAsync").filter(t => t[0] === GitHubNames.readSignInMethod).map(t => t[1]);
  }

  public button(label: string): HTMLButtonElement {
    const found = [...this.element.querySelectorAll("button")].find(t => (t.textContent ?? "").includes(label));
    if (Object.isUndefined(found))
      throw new Error(`No button reads ${label}.`);
    return found;
  }

  public async clickAsync(label: string): Promise<void> {
    this.button(label).click();
    await this.settleAsync();
  }
}

describe("GitHubAccountsComponent", () => {
  it("shows each account's sign-in, numbered, and offers another account once one is signed in", async () => {
    const page = new Page();
    page.requests.answer(GitHubNames.readAccountsMethod, listOf(kim, lee).toJson());
    page.requests.answer(GitHubNames.readSignInMethod, kim.toJson(), lee.toJson());
    await page.openAsync();

    expect([page.texts("h3"), page.texts(".nol-git-github-account-text .nol-git-github-strong"), page.readsOf()])
      .toEqual([["Account 1", "Account 2"], ["kim", "lee"], [null, new AccountQuery(2).toJson()]]);
    expect(page.button("Add another GitHub account").disabled).toBe(false);
  });

  it("shows only the account its card opened it on, titled as the one account, and adds none from there while there are others", async () => {
    const page = new Page();
    page.requests.answer(GitHubNames.readAccountsMethod, listOf(kim, lee).toJson());
    page.requests.answer(GitHubNames.readSignInMethod, lee.toJson());
    await page.openAsync("2");

    expect([page.texts("h3"), page.texts(".nol-git-github-account-text .nol-git-github-strong"), page.readsOf(), page.texts("button").includes("Add another GitHub account")])
      .toEqual([["Account"], ["lee"], [new AccountQuery(2).toJson()], false]);
  });

  it("offers another account from the only account's card", async () => {
    const page = new Page();
    page.requests.answer(GitHubNames.readAccountsMethod, listOf(kim).toJson());
    page.requests.answer(GitHubNames.readSignInMethod, kim.toJson());
    await page.openAsync("1");

    expect([page.texts("h3"), page.texts("button").some(t => t.includes("Add another GitHub account"))]).toEqual([["Account"], true]);
  });

  it.each([["7"], ["x"], ["0"]])("shows every account when the account it was opened on, %s, isn't in the list", async chosen => {
    const page = new Page();
    page.requests.answer(GitHubNames.readAccountsMethod, listOf(kim, lee).toJson());
    page.requests.answer(GitHubNames.readSignInMethod, kim.toJson(), lee.toJson());
    await page.openAsync(chosen);

    expect(page.texts("h3")).toEqual(["Account 1", "Account 2"]);
  });

  it("offers no other account while none is signed in, or while one waits for its code", async () => {
    const signedOut = new Page();
    signedOut.requests.answer(GitHubNames.readAccountsMethod, listOf(HostSignIn.signedOut()).toJson());
    signedOut.requests.answer(GitHubNames.readSignInMethod, HostSignIn.signedOut().toJson());
    await signedOut.openAsync();
    const whileSignedOut = signedOut.texts("button");
    TestBed.resetTestingModule();
    const waiting = new Page();
    waiting.requests.answer(GitHubNames.readAccountsMethod, listOf(kim, HostSignIn.waiting(code)).toJson());
    waiting.requests.answer(GitHubNames.readSignInMethod, kim.toJson(), HostSignIn.waiting(code).toJson());
    await waiting.openAsync();

    expect([whileSignedOut.some(t => t.includes("Add another")), waiting.texts("button").some(t => t.includes("Add another"))]).toEqual([false, false]);
  });

  it("adds an account, shows its sign-in, and copies its code and opens GitHub's page, whether the list's change comes before the answer or after", async () => {
    const shown: unknown[][] = [];
    for (const isEventFirst of [false, true]) {
      const page = new Page();
      page.requests.answer(GitHubNames.readAccountsMethod, listOf(kim).toJson());
      page.requests.answer(GitHubNames.readSignInMethod, kim.toJson(), HostSignIn.waiting(code).toJson());
      page.context.answer("openLinkAsync", async () => undefined);
      await page.openAsync();
      const release = page.requests.hold(GitHubNames.addAccountMethod);

      page.button("Add another GitHub account").click();
      await page.requests.askedAsync(3);
      if (isEventFirst)
        page.context.raiseEvent(GitHubNames.accountsChangedEvent, listOf(kim, HostSignIn.waiting(code)).toJson());
      release(new HostAccountEntry(2, HostSignIn.waiting(code)).toJson());
      await page.settleAsync();
      await page.settleAsync();

      shown.push([page.texts("h3"), page.texts(".nol-git-github-code"), page.context.callsOf("openLinkAsync").map(t => t[0]), page.readsOf()]);
      TestBed.resetTestingModule();
    }

    const expected = [["Account 1", "Account 2"], ["WDJB-MJHT"], ["https://github.com/login/device"], [null, new AccountQuery(2).toJson()]];
    expect(shown).toEqual([expected, expected]);
  });

  it("says and logs that GitHub didn't add the account, and keeps the list as it was", async () => {
    const page = new Page();
    page.requests.answer(GitHubNames.readAccountsMethod, listOf(kim).toJson());
    page.requests.answer(GitHubNames.readSignInMethod, kim.toJson());
    page.requests.fail(GitHubNames.addAccountMethod, new WindowFailure("Not connected."));
    await page.openAsync();

    await page.clickAsync("Add another GitHub account");

    expect([page.texts("[role=alert] .nol-git-github-banner-text > span"), page.texts("h3"), page.logs]).toEqual([["GitHub didn't add the account.",
      "Try again; the app's log has the details."], ["Account"], [`The GitHub module's ${GitHubNames.addAccountMethod} request failed: WindowFailure: Not connected.`]]);
  });

  it("passes on a failure to add an account that isn't the window's, rather than saying GitHub didn't add it", async () => {
    const page = new Page();
    const unexpected = new TypeError("Unexpected.");
    page.requests.answer(GitHubNames.readAccountsMethod, listOf(kim).toJson());
    page.requests.answer(GitHubNames.readSignInMethod, kim.toJson());
    page.requests.fail(GitHubNames.addAccountMethod, unexpected);
    await page.openAsync();
    const rejected = UnhandledRejections.nextAsync();

    page.button("Add another GitHub account").click();

    expect(await rejected).toBe(unexpected);
    expect([page.logs, page.element.querySelector("[role=alert]")]).toEqual([[], null]);
  });

  it("shows the first account alone, and logs why, when the accounts can't be read", async () => {
    const page = new Page();
    page.requests.fail(GitHubNames.readAccountsMethod, new WindowFailure("Not connected."));
    page.requests.answer(GitHubNames.readSignInMethod, kim.toJson());
    await page.openAsync();

    expect([page.texts("h3"), page.readsOf(), page.texts("button").some(t => t.includes("Add another")), page.logs]).toEqual([["Account"], [null], false,
      [`The GitHub module's ${GitHubNames.readAccountsMethod} request failed: WindowFailure: Not connected.`]]);
  });

  it("shows no account, and reads none, until the accounts are read", async () => {
    const page = new Page();
    const release = page.requests.hold(GitHubNames.readAccountsMethod);
    page.requests.answer(GitHubNames.readSignInMethod, lee.toJson());
    const opening = page.openAsync("2");
    await page.requests.askedAsync(1);
    page.fixture?.detectChanges();
    const before = [page.texts("h3"), page.readsOf(), page.texts("button")];
    release(listOf(kim, lee).toJson());
    await opening;

    expect([before, page.texts("h3")]).toEqual([[[], [], []], ["Account"]]);
  });

  it("passes on a failure of the accounts' read that isn't the window's", async () => {
    const page = new Page();
    const unexpected = new TypeError("Unexpected.");
    page.requests.fail(GitHubNames.readAccountsMethod, unexpected);
    page.requests.answer(GitHubNames.readSignInMethod, kim.toJson());
    const rejected = UnhandledRejections.nextAsync();
    await page.openAsync();

    expect(await rejected).toBe(unexpected);
    expect(page.logs).toEqual([]);
  });

  it("follows the list's changes until it closes, and drops a read that a change overtook", async () => {
    const page = new Page();
    const release = page.requests.hold(GitHubNames.readAccountsMethod);
    page.requests.answer(GitHubNames.readSignInMethod, kim.toJson(), lee.toJson());
    const opening = page.openAsync();
    await page.requests.askedAsync(1);

    page.context.raiseEvent(GitHubNames.accountsChangedEvent, listOf(kim, lee).toJson());
    release(listOf(kim).toJson());
    await opening;
    await page.settleAsync();
    const shown = page.texts("h3");
    page.fixture?.destroy();

    expect([shown, page.context.activeCallsOf("onEvent").filter(t => t[0] === GitHubNames.accountsChangedEvent)]).toEqual([["Account 1", "Account 2"], []]);
  });
});
