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
import { AccountQuery, HostAccount, HostAccountEntry, HostAccountList, HostSignIn } from "@noldova/git.hosting.protocol";
import { GitHostAccounts } from "@noldova/git.window";
import { describe, expect, it } from "vitest";

import { AzureDevOpsAccountsComponent } from "../../../../src/app/components/azure-devops-accounts/azure-devops-accounts.component.ts";
import { RequestAnswers } from "../../../fixtures/request-answers.fixture.ts";
import { UnhandledRejections } from "../../../fixtures/unhandled-rejections.fixture.ts";
import { WindowFailure } from "../../../fixtures/window-failure.fixture.ts";

const ADDRESS: string = "https://login.microsoftonline.com/organizations/oauth2/v2.0/authorize?client_id=contoso&state=example";
const ADD: string = "Add another Azure DevOps account";
const kim: HostSignIn = HostSignIn.signedIn(new HostAccount("kim@example.com", null, null, []));
const lee: HostSignIn = HostSignIn.signedIn(new HostAccount("lee@example.com", null, null, []));
const waiting: HostSignIn = HostSignIn.waitingInBrowser(ADDRESS);

function listOf(...signIns: HostSignIn[]): HostAccountList {
  return new HostAccountList(signIns.map((t, i) => new HostAccountEntry(i + 1, t, "dev.azure.com/fabrikam")));
}

class Page {
  public readonly context: FakeWindowPartContext = new FakeWindowPartContext();
  public readonly requests: RequestAnswers = new RequestAnswers(this.context);
  public fixture: ComponentFixture<AzureDevOpsAccountsComponent> | null = null;

  public get element(): HTMLElement {
    const element = this.fixture?.nativeElement;
    if (!(element instanceof HTMLElement))
      throw new Error("The page isn't open.");
    return element;
  }

  public get logs(): readonly unknown[] {
    return this.context.callsOf("log").map(t => t[0]);
  }

  public get logins(): string[] {
    return this.texts(".nol-git-azure-devops-account-text > .nol-git-azure-devops-strong");
  }

  public async openAsync(chosen: string | null = null): Promise<this> {
    TestBed.configureTestingModule({ providers: [{ provide: WindowPartTokens.context, useValue: this.context },
      { provide: GitHostAccounts.chosenAccount, useValue: chosen }] });
    this.fixture = TestBed.createComponent(AzureDevOpsAccountsComponent);
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
    return this.context.callsOf("requestAsync").filter(t => t[0] === AzureDevOpsNames.readSignInMethod).map(t => t[1]);
  }

  public offersAdd(): boolean {
    return this.texts("button").some(t => t.includes(ADD));
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

describe("AzureDevOpsAccountsComponent", () => {
  it("shows each account's sign-in, naming the account in each read past the first, and offers another account once one is signed in", async () => {
    const page = new Page();
    page.requests.answer(AzureDevOpsNames.readAccountsMethod, listOf(kim, lee).toJson());
    page.requests.answer(AzureDevOpsNames.readSignInMethod, kim.toJson(), lee.toJson());
    await page.openAsync();

    expect([page.logins, page.readsOf()]).toEqual([["kim@example.com", "lee@example.com"], [null, new AccountQuery(2).toJson()]]);
    expect(page.button(ADD).disabled).toBe(false);
  });

  it("shows only the account its card opened it on, and adds none from there while there are others", async () => {
    const page = new Page();
    page.requests.answer(AzureDevOpsNames.readAccountsMethod, listOf(kim, lee).toJson());
    page.requests.answer(AzureDevOpsNames.readSignInMethod, lee.toJson());
    await page.openAsync("2");

    expect([page.logins, page.readsOf(), page.offersAdd()]).toEqual([["lee@example.com"], [new AccountQuery(2).toJson()], false]);
  });

  it("offers another account from the only account's card", async () => {
    const page = new Page();
    page.requests.answer(AzureDevOpsNames.readAccountsMethod, listOf(kim).toJson());
    page.requests.answer(AzureDevOpsNames.readSignInMethod, kim.toJson());
    await page.openAsync("1");

    expect([page.logins, page.offersAdd()]).toEqual([["kim@example.com"], true]);
  });

  it.each([["7"], ["x"], ["0"]])("shows every account when the account it was opened on, %s, isn't in the list", async chosen => {
    const page = new Page();
    page.requests.answer(AzureDevOpsNames.readAccountsMethod, listOf(kim, lee).toJson());
    page.requests.answer(AzureDevOpsNames.readSignInMethod, kim.toJson(), lee.toJson());
    await page.openAsync(chosen);

    expect(page.logins).toEqual(["kim@example.com", "lee@example.com"]);
  });

  it("offers no other account while none is signed in, or while one waits for the browser", async () => {
    const signedOut = new Page();
    signedOut.requests.answer(AzureDevOpsNames.readAccountsMethod, listOf(HostSignIn.signedOut()).toJson());
    signedOut.requests.answer(AzureDevOpsNames.readSignInMethod, HostSignIn.signedOut().toJson());
    await signedOut.openAsync();
    const whileSignedOut = signedOut.offersAdd();
    TestBed.resetTestingModule();
    const inBrowser = new Page();
    inBrowser.requests.answer(AzureDevOpsNames.readAccountsMethod, listOf(kim, waiting).toJson());
    inBrowser.requests.answer(AzureDevOpsNames.readSignInMethod, kim.toJson(), waiting.toJson());
    await inBrowser.openAsync();

    expect([whileSignedOut, inBrowser.offersAdd()]).toEqual([false, false]);
  });

  it("opens the add's form, titled as another account, in place of the offer, reading nothing for it, and gives the offer back on Cancel", async () => {
    const page = new Page();
    page.requests.answer(AzureDevOpsNames.readAccountsMethod, listOf(kim).toJson());
    page.requests.answer(AzureDevOpsNames.readSignInMethod, kim.toJson());
    await page.openAsync();

    await page.clickAsync(ADD);
    const form = [page.texts("h3"), page.offersAdd(), page.element.querySelectorAll(".nol-git-azure-devops-organization").length];
    await page.clickAsync("Cancel");

    expect(form).toEqual([["Account", "Another account"], false, 1]);
    expect([page.texts("h3"), page.offersAdd(), page.readsOf()]).toEqual([["Account"], true, [null]]);
  });

  it("adds an account with Microsoft, shows its sign-in and opens its address once, whether the list's change comes before the add's answer or after", async () => {
    const shown: unknown[][] = [];
    for (const isEventFirst of [false, true]) {
      const page = new Page();
      page.requests.answer(AzureDevOpsNames.readAccountsMethod, listOf(kim).toJson());
      page.requests.answer(AzureDevOpsNames.readSignInMethod, kim.toJson(), waiting.toJson());
      page.context.answer("openLinkAsync", async () => undefined);
      await page.openAsync();
      await page.clickAsync(ADD);
      const field = page.element.querySelector(".nol-git-azure-devops-organization");
      if (!(field instanceof HTMLInputElement))
        throw new Error("The add's form has no organization field.");
      field.value = "fabrikam";
      field.dispatchEvent(new Event("input"));
      await page.settleAsync();
      const release = page.requests.hold(AzureDevOpsNames.addAccountMethod);

      page.button("Sign in with Microsoft").click();
      await page.requests.askedAsync(3);
      if (isEventFirst)
        page.context.raiseEvent(AzureDevOpsNames.accountsChangedEvent, listOf(kim, waiting).toJson());
      release(new HostAccountEntry(2, waiting, "dev.azure.com/fabrikam").toJson());
      await page.settleAsync();
      await page.settleAsync();

      shown.push([page.texts("h3"), page.offersAdd(), page.context.callsOf("openLinkAsync").map(t => [t[0], Object.isObject(t[1]) && "place" in t[1] ? t[1].place : null]),
        page.readsOf()]);
      TestBed.resetTestingModule();
    }

    const expected = [["Account", "Account"], false, [[ADDRESS, LinkPlace.System]], [null, new AccountQuery(2).toJson()]];
    expect(shown).toEqual([expected, expected]);
  });

  it("shows the first account alone, and logs why, when the accounts can't be read", async () => {
    const page = new Page();
    page.requests.fail(AzureDevOpsNames.readAccountsMethod, new WindowFailure("Not connected."));
    page.requests.answer(AzureDevOpsNames.readSignInMethod, kim.toJson());
    await page.openAsync();

    expect([page.logins, page.readsOf(), page.offersAdd(), page.logs]).toEqual([["kim@example.com"], [null], false,
      [`The Azure DevOps module's ${AzureDevOpsNames.readAccountsMethod} request failed: WindowFailure: Not connected.`]]);
  });

  it("shows no account, and reads none, until the accounts are read", async () => {
    const page = new Page();
    const release = page.requests.hold(AzureDevOpsNames.readAccountsMethod);
    page.requests.answer(AzureDevOpsNames.readSignInMethod, lee.toJson());
    const opening = page.openAsync("2");
    await page.requests.askedAsync(1);
    page.fixture?.detectChanges();
    const before = [page.texts("h3"), page.readsOf(), page.texts("button")];
    release(listOf(kim, lee).toJson());
    await opening;

    expect([before, page.logins]).toEqual([[[], [], []], ["lee@example.com"]]);
  });

  it("passes on a failure of the accounts' read that isn't the window's", async () => {
    const page = new Page();
    const unexpected = new TypeError("Unexpected.");
    page.requests.fail(AzureDevOpsNames.readAccountsMethod, unexpected);
    page.requests.answer(AzureDevOpsNames.readSignInMethod, kim.toJson());
    const rejected = UnhandledRejections.nextAsync();
    await page.openAsync();

    expect(await rejected).toBe(unexpected);
    expect(page.logs).toEqual([]);
  });

  it("follows the list's changes until it closes, and drops a read that a change overtook", async () => {
    const page = new Page();
    const release = page.requests.hold(AzureDevOpsNames.readAccountsMethod);
    page.requests.answer(AzureDevOpsNames.readSignInMethod, kim.toJson(), lee.toJson());
    const opening = page.openAsync();
    await page.requests.askedAsync(1);

    page.context.raiseEvent(AzureDevOpsNames.accountsChangedEvent, listOf(kim, lee).toJson());
    release(listOf(kim).toJson());
    await opening;
    await page.settleAsync();
    const shown = page.logins;
    page.fixture?.destroy();

    expect([shown, page.context.activeCallsOf("onEvent").filter(t => t[0] === AzureDevOpsNames.accountsChangedEvent)])
      .toEqual([["kim@example.com", "lee@example.com"], []]);
  });
});
