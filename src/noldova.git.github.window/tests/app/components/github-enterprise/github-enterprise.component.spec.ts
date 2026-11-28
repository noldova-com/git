/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { type ComponentFixture, TestBed } from "@angular/core/testing";
import "@noldova/context.core";
import { FailureCode } from "@noldova/desktop.protocol";
import { LinkPlace, RuntimeRequestException, WindowPartTokens } from "@noldova/desktop.window";
import { FakeWindowPartContext } from "@noldova/desktop.window/testing";
import { GitHubNames } from "@noldova/git.github.protocol";
import { AccountQuery, HostAccount, HostAccountEntry, HostAccountList, HostSignIn, SignInFailure } from "@noldova/git.hosting.protocol";
import { GitHostAccounts } from "@noldova/git.window";
import { describe, expect, it } from "vitest";

import { GitHubEnterpriseComponent } from "../../../../src/app/components/github-enterprise/github-enterprise.component.ts";
import { RequestAnswers } from "../../../fixtures/request-answers.fixture.ts";
import { UnhandledRejections } from "../../../fixtures/unhandled-rejections.fixture.ts";
import { WindowFailure } from "../../../fixtures/window-failure.fixture.ts";

const SERVER: string = "ghe.example.com";
const mona: HostAccount = new HostAccount("monalisa", "Mona", null, ["repo"]);
const kim: HostSignIn = HostSignIn.signedIn(new HostAccount("kim", null, null, ["repo"]));
const monaEntry: HostAccountEntry = new HostAccountEntry(2, HostSignIn.signedIn(mona), undefined, SERVER);
const note: string = "Connect an account on your company's GitHub Enterprise server with a personal access token.";

function listOf(...entries: HostAccountEntry[]): HostAccountList {
  return new HostAccountList([new HostAccountEntry(1, kim), ...entries]);
}

class Page {
  public readonly context: FakeWindowPartContext = new FakeWindowPartContext();
  public readonly requests: RequestAnswers = new RequestAnswers(this.context);
  public fixture: ComponentFixture<GitHubEnterpriseComponent> | null = null;

  public constructor() {
    this.context.answer("openLinkAsync", async () => undefined);
  }

  public get element(): HTMLElement {
    const element = this.fixture?.nativeElement;
    if (!(element instanceof HTMLElement))
      throw new Error("The page isn't open.");
    return element;
  }

  public get logs(): readonly unknown[] {
    return this.context.callsOf("log").map(t => t[0]);
  }

  public get links(): readonly unknown[] {
    return this.context.callsOf("openLinkAsync");
  }

  public get server(): HTMLInputElement {
    return this.field("GitHub Enterprise server");
  }

  public get token(): HTMLInputElement {
    return this.field("Personal access token");
  }

  public get alerts(): string[] {
    return this.texts("[role=alert]");
  }

  public async openAsync(chosen: string | null = null, isProvided: boolean = true): Promise<this> {
    TestBed.configureTestingModule({ providers: [{ provide: WindowPartTokens.context, useValue: this.context },
      ...isProvided ? [{ provide: GitHostAccounts.chosenAccount, useValue: chosen }] : []] });
    this.fixture = TestBed.createComponent(GitHubEnterpriseComponent);
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

  public field(label: string): HTMLInputElement {
    const found = this.element.querySelector(`input[aria-label="${label}"]`);
    if (!(found instanceof HTMLInputElement))
      throw new Error(`No field is labelled ${label}.`);
    return found;
  }

  public button(label: string): HTMLButtonElement {
    const found = [...this.element.querySelectorAll("button")].find(t => (t.textContent ?? "").includes(label));
    if (Object.isUndefined(found))
      throw new Error(`No button reads ${label}.`);
    return found;
  }

  public async typeAsync(field: HTMLInputElement, value: string): Promise<void> {
    field.value = value;
    field.dispatchEvent(new Event("input"));
    await this.settleAsync();
  }

  public async clickAsync(label: string): Promise<void> {
    this.button(label).click();
    await this.settleAsync();
  }

  public async enterAsync(): Promise<void> {
    this.token.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter" }));
    await this.settleAsync();
  }
}

describe("GitHubEnterpriseComponent", () => {
  it("asks for the server's name and a token, opening the server's token page with the repo scope ticked and the app's name filled", async () => {
    const page = new Page();
    page.requests.answer(GitHubNames.readAccountsMethod, listOf().toJson());
    await page.openAsync();
    const before = [page.button("Create a token on the server").disabled, page.button("Connect").disabled];

    await page.typeAsync(page.server, " GHE.Example.com ");
    await page.clickAsync("Create a token on the server");
    await page.typeAsync(page.token, "ghp_mona");

    expect([page.texts("h3"), page.texts(".nol-git-github-setting-note")]).toEqual([["GitHub Enterprise account"], [note,
      "Create the token on the server's page; it opens with the repo scope ticked and the token named for this app."]]);
    expect([before, page.button("Create a token on the server").disabled, page.button("Connect").disabled]).toEqual([[true, true], false, false]);
    expect(page.links).toEqual([["https://ghe.example.com/settings/tokens/new?scopes=repo&description=Noldova%20Git", { place: LinkPlace.System }]]);
    expect([page.server.placeholder, page.token.type, page.token.autocomplete]).toEqual(["github.example.com", "password", "off"]);
  });

  it("connects with the server's name in lowercase and the token, clears the token, shows the account with its server, and manages its tokens there", async () => {
    const page = new Page();
    page.requests.answer(GitHubNames.readAccountsMethod, listOf().toJson());
    page.requests.answer(GitHubNames.signInWithTokenMethod, monaEntry.toJson());
    await page.openAsync(null, false);
    await page.typeAsync(page.server, "GHE.example.com");
    const token = page.token;
    await page.typeAsync(token, " ghp_mona ");

    await page.enterAsync();
    await page.clickAsync("Manage tokens on the server");

    expect(page.requests.payloads.slice(1)).toEqual([{ host: SERVER, token: "ghp_mona" }]);
    expect([token.value, page.texts("h3"), page.texts(".nol-git-github-label"), page.alerts]).toEqual(["", ["Mona"], ["monalisa · ghe.example.com"], []]);
    expect(page.links).toEqual([["https://ghe.example.com/settings/tokens", { place: LinkPlace.System }]]);
  });

  it("signs a chosen account out, then asks for a new token on its server", async () => {
    const page = new Page();
    const unnamed = new HostAccountEntry(2, HostSignIn.signedIn(new HostAccount("monalisa", null, null, ["repo"])), undefined, SERVER);
    page.requests.answer(GitHubNames.readAccountsMethod, listOf(unnamed).toJson());
    page.requests.answer(GitHubNames.signOutMethod, HostSignIn.signedOut().toJson());
    await page.openAsync("2");
    const shown = [page.texts("h3"), page.texts(".nol-git-github-label")];

    await page.clickAsync("Sign out");
    page.context.raiseEvent(GitHubNames.accountsChangedEvent, listOf().toJson());
    await page.settleAsync();

    expect(shown).toEqual([["monalisa"], ["monalisa · ghe.example.com"]]);
    expect([page.requests.payloads.slice(1), page.texts("h3"), page.server.value]).toEqual([[new AccountQuery(2).toJson()], ["GitHub Enterprise account"], SERVER]);
  });

  it("keeps the account shown, and logs why, when the sign-out isn't answered", async () => {
    const page = new Page();
    page.requests.answer(GitHubNames.readAccountsMethod, listOf(monaEntry).toJson());
    page.requests.fail(GitHubNames.signOutMethod, new WindowFailure("Not connected."));
    await page.openAsync("2");

    await page.clickAsync("Sign out");

    expect([page.texts("h3"), page.alerts, page.logs]).toEqual([["Mona"], ["GitHub's sign-in didn't answer."],
      [`The GitHub module's ${GitHubNames.signOutMethod} request failed: WindowFailure: Not connected.`]]);
  });

  it("shows why a chosen account was signed out, with its server filled in, and forgets it once a new token connects", async () => {
    const page = new Page();
    const revoked = new HostAccountEntry(3, HostSignIn.signedOut(SignInFailure.Revoked), undefined, SERVER);
    page.requests.answer(GitHubNames.readAccountsMethod, listOf(revoked).toJson());
    page.requests.answer(GitHubNames.signInWithTokenMethod, new HostAccountEntry(4, HostSignIn.signedIn(mona), undefined, SERVER).toJson());
    page.requests.answer(GitHubNames.signOutMethod, HostSignIn.signedOut().toJson());
    await page.openAsync("3");
    const shown = [page.alerts, page.server.value, page.texts(".nol-git-github-setting-note").includes(note)];

    await page.typeAsync(page.token, "ghp_new");
    await page.clickAsync("Connect");

    expect(shown).toEqual([["GitHub no longer accepts this computer's sign-in. Sign in again to restore it."], SERVER, false]);
    expect([page.requests.payloads.slice(1), page.texts("h3")]).toEqual([[{ host: SERVER, token: "ghp_new" }, new AccountQuery(3).toJson()], ["Mona"]]);
  });

  it("shows the module's reason for a refused token, and a plain line when the connect isn't answered, clearing the token each time", async () => {
    const page = new Page();
    page.requests.answer(GitHubNames.readAccountsMethod, listOf().toJson());
    const scope = "The token for ghe.example.com doesn't have the repo scope, which reading and opening pull requests needs. Create one with repo ticked.";
    page.requests.fail(GitHubNames.signInWithTokenMethod, new RuntimeRequestException(FailureCode.Unauthorized, scope));
    page.requests.fail(GitHubNames.signInWithTokenMethod, new WindowFailure("Not connected."));
    await page.openAsync();
    await page.typeAsync(page.server, SERVER);
    const shown: unknown[] = [];

    for (let i = 0; i < 2; i++) {
      await page.typeAsync(page.token, "ghp_x");
      await page.clickAsync("Connect");
      shown.push([page.alerts, page.token.value, page.button("Connect").disabled]);
    }

    expect(shown).toEqual([[[scope], "", true], [["The GitHub module didn't answer the connect."], "", true]]);
    expect(page.logs).toEqual([`The GitHub module's ${GitHubNames.signInWithTokenMethod} request failed: RuntimeRequestException: ${scope}`,
      `The GitHub module's ${GitHubNames.signInWithTokenMethod} request failed: WindowFailure: Not connected.`]);
  });

  it("says so when the account is already in the list, or the answer isn't a sign-in, and stays on the form", async () => {
    const page = new Page();
    page.requests.answer(GitHubNames.readAccountsMethod, listOf().toJson());
    page.requests.answer(GitHubNames.signInWithTokenMethod, new HostAccountEntry(5, HostSignIn.signedOut(SignInFailure.AlreadyKept), undefined, SERVER).toJson(),
      new HostAccountEntry(6, HostSignIn.signedOut(), undefined, SERVER).toJson());
    await page.openAsync();
    await page.typeAsync(page.server, SERVER);
    const shown: unknown[] = [];

    for (let i = 0; i < 2; i++) {
      await page.typeAsync(page.token, "ghp_x");
      await page.clickAsync("Connect");
      shown.push([page.alerts, page.texts("h3")]);
    }

    expect(shown).toEqual([[["This GitHub account is already in the list."], ["GitHub Enterprise account"]],
      [["The GitHub module didn't answer the connect."], ["GitHub Enterprise account"]]]);
  });

  it("sends nothing on Enter without a token or a server, or while a connect is on its way", async () => {
    const page = new Page();
    page.requests.answer(GitHubNames.readAccountsMethod, listOf().toJson());
    const release = page.requests.hold(GitHubNames.signInWithTokenMethod);
    await page.openAsync();

    await page.typeAsync(page.token, "ghp_x");
    await page.enterAsync();
    await page.typeAsync(page.server, SERVER);
    await page.typeAsync(page.token, "  ");
    await page.enterAsync();
    await page.typeAsync(page.token, "ghp_x");
    page.token.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter" }));
    page.token.value = "ghp_y";
    await page.enterAsync();
    release(monaEntry.toJson());
    await page.settleAsync();

    expect(page.requests.methods.slice(1)).toEqual([GitHubNames.signInWithTokenMethod]);
  });

  it("says the page couldn't be opened, and logs why, when the token page doesn't open", async () => {
    const page = new Page();
    page.requests.answer(GitHubNames.readAccountsMethod, listOf().toJson());
    page.context.answer("openLinkAsync", async () => {
      throw new WindowFailure("No browser.");
    });
    await page.openAsync();
    await page.typeAsync(page.server, SERVER);

    await page.clickAsync("Create a token on the server");

    expect([page.alerts, page.logs]).toEqual([["The page couldn't be opened."],
      ["The GitHub module couldn't open https://ghe.example.com/settings/tokens/new?scopes=repo&description=Noldova%20Git: WindowFailure: No browser."]]);
  });

  it("logs a read that fails and keeps the form, and drops a read that answers after a change", async () => {
    const failed = new Page();
    failed.requests.fail(GitHubNames.readAccountsMethod, new WindowFailure("Not connected."));
    await failed.openAsync("2");
    const failedShown = [failed.texts("h3"), failed.logs];
    TestBed.resetTestingModule();
    const late = new Page();
    const release = late.requests.hold(GitHubNames.readAccountsMethod);
    await late.openAsync("2");
    late.context.raiseEvent(GitHubNames.accountsChangedEvent, listOf(monaEntry).toJson());
    await late.settleAsync();
    release(listOf().toJson());
    await late.settleAsync();

    expect(failedShown).toEqual([["GitHub Enterprise account"], [`The GitHub module's ${GitHubNames.readAccountsMethod} request failed: WindowFailure: Not connected.`]]);
    expect([late.texts("h3"), late.texts(".nol-git-github-label")]).toEqual([["Mona"], ["monalisa · ghe.example.com"]]);
  });

  it("passes on failures that aren't the window's", async () => {
    const unexpected = new TypeError("Unexpected.");
    const page = new Page();
    page.requests.answer(GitHubNames.readAccountsMethod, listOf(monaEntry).toJson());
    page.requests.fail(GitHubNames.signOutMethod, unexpected);
    page.requests.fail(GitHubNames.signInWithTokenMethod, unexpected);
    page.context.answer("openLinkAsync", async () => {
      throw unexpected;
    });
    await page.openAsync("2");
    const rejections: unknown[] = [];

    let rejected = UnhandledRejections.nextAsync();
    page.button("Manage tokens on the server").click();
    rejections.push(await rejected);
    rejected = UnhandledRejections.nextAsync();
    page.button("Sign out").click();
    rejections.push(await rejected);
    page.context.raiseEvent(GitHubNames.accountsChangedEvent, listOf().toJson());
    await page.settleAsync();
    await page.typeAsync(page.server, SERVER);
    await page.typeAsync(page.token, "ghp_x");
    rejected = UnhandledRejections.nextAsync();
    page.button("Connect").click();
    rejections.push(await rejected);
    TestBed.resetTestingModule();
    const read = new Page();
    read.requests.fail(GitHubNames.readAccountsMethod, unexpected);
    rejected = UnhandledRejections.nextAsync();
    await read.openAsync();
    rejections.push(await rejected);

    expect(rejections).toEqual([unexpected, unexpected, unexpected, unexpected]);
    expect(page.logs).toEqual([]);
  });
});
