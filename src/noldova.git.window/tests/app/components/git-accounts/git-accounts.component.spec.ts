/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Component, inject, signal, type WritableSignal } from "@angular/core";
import { type ComponentFixture, TestBed } from "@angular/core/testing";
import "@noldova/context.core";
import { type IWindowPartContext, WindowPartTokens } from "@noldova/desktop.window";
import { FakeWindowPartContext } from "@noldova/desktop.window/testing";
import { afterEach, describe, expect, it, onTestFinished } from "vitest";

import { GitAccountsComponent } from "../../../../src/app/components/git-accounts/git-accounts.component.ts";
import { GitHostCardState } from "../../../../src/app/enums/git-host-card-state.ts";
import { GitHostFeature } from "../../../../src/app/enums/git-host-feature.ts";
import type { IGitHostAccount } from "../../../../src/app/interfaces/i-git-host-account.ts";
import { GitHostCard } from "../../../../src/app/models/git-host-card.ts";
import { GitHostAccounts } from "../../../../src/app/services/git-host-accounts.ts";

const signInContexts: IWindowPartContext[] = [];

@Component({ selector: "nol-git-test-sign-in", template: "<p class=\"test-sign-in\">Sign-in</p>" })
class TestSignInComponent {
  public constructor() {
    signInContexts.push(inject(WindowPartTokens.context));
  }
}

const signedOut: GitHostCard = new GitHostCard("GitHub", "Sign in to see pull requests.", GitHostCardState.SignedOut, "Sign in");
const failed: GitHostCard = new GitHostCard("GitHub", "GitHub's sign-in couldn't be read.", GitHostCardState.Failed, "Sign in");
const signedIn: GitHostCard = new GitHostCard("Azure DevOps · kim@example.com", "Signed in on this computer", GitHostCardState.SignedIn, "Signed in");
const waiting: GitHostCard = new GitHostCard("Azure DevOps", "Finish signing in in the browser.", GitHostCardState.Waiting, "Waiting for the browser");

class Page {
  public readonly fixture: ComponentFixture<GitAccountsComponent>;
  public readonly element: HTMLElement;

  public constructor() {
    this.fixture = TestBed.createComponent(GitAccountsComponent);
    this.element = this.fixture.nativeElement;
  }

  public texts(selector: string, root: ParentNode = this.element): string[] {
    return [...root.querySelectorAll(selector)].map(t => t.textContent?.trim() ?? "");
  }

  public find(selector: string, root: ParentNode = this.element): HTMLElement {
    const found: HTMLElement | null = root.querySelector<HTMLElement>(selector);
    if (Object.isNull(found))
      throw new Error(`Nothing matches ${selector}.`);
    return found;
  }

  public async clickAsync(element: HTMLElement): Promise<void> {
    element.click();
    await this.fixture.whenStable();
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

  public dialog(): HTMLElement | null {
    return document.querySelector<HTMLElement>("nol-git-account-dialog");
  }

  public async closeDialogAsync(): Promise<void> {
    await this.clickAsync(this.find(".nol-dialog-close", document));
    await this.untilAsync(() => Object.isNull(this.dialog()));
  }
}

function accountOf(id: string, host: string, mark: string, cards: WritableSignal<readonly GitHostCard[]>, features: GitHostFeature[]): IGitHostAccount {
  return { id, host, column: host === "Azure DevOps" ? "Azure" : host, mark, markColor: "#24292f", cards, signIn: TestSignInComponent, features };
}

describe("GitAccountsComponent", () => {
  const github: FakeWindowPartContext = new FakeWindowPartContext();
  const azure: FakeWindowPartContext = new FakeWindowPartContext();

  function provide(context: IWindowPartContext, account: IGitHostAccount): void {
    onTestFinished(GitHostAccounts.provide(context, account));
  }

  afterEach(() => {
    signInContexts.length = 0;
  });

  it("shows each host's cards with its mark, title and detail, a sign-in button while signed out or failed, and a chip and manage button otherwise", async () => {
    const githubCards: WritableSignal<readonly GitHostCard[]> = signal([signedOut]);
    const azureCards: WritableSignal<readonly GitHostCard[]> = signal([signedIn, waiting]);
    provide(github, accountOf("git-github.account", "GitHub", "GH", githubCards, [GitHostFeature.PullRequests]));
    provide(azure, accountOf("git-azure-devops.account", "Azure DevOps", "Az", azureCards, [GitHostFeature.PullRequests, GitHostFeature.WorkItems]));
    const page: Page = new Page();
    await page.fixture.whenStable();

    const cards = (): string[][] => [...page.element.querySelectorAll(".card")].map(t => [
      page.texts(".mark", t).join(), page.texts(".card-title", t).join(), page.texts(".detail", t).join(), page.texts("button[nol-button]", t).join(),
      page.texts("nol-chip", t).join(), [...t.querySelectorAll("nol-chip")].map(u => u.classList.contains("nol-chip-on") ? "on" : "status").join(),
      [...t.querySelectorAll("button[nol-icon-button]")].map(u => u.getAttribute("aria-label") ?? "").join()
    ]);
    const before: string[][] = cards();
    githubCards.set([failed]);
    await page.fixture.whenStable();

    expect(before).toEqual([
      ["GH", "GitHub", "Sign in to see pull requests.", "Sign in", "", "", ""],
      ["Az", "Azure DevOps · kim@example.com", "Signed in on this computer", "", "Signed in", "on", "Manage the Azure DevOps account"],
      ["Az", "Azure DevOps", "Finish signing in in the browser.", "", "Waiting for the browser", "status", "Manage the Azure DevOps account"]
    ]);
    expect(cards()[0]).toEqual(["GH", "GitHub", "GitHub's sign-in couldn't be read.", "Sign in", "", "", ""]);
    expect([...page.element.querySelectorAll(".host")].map(t => t.getAttribute("data-setting"))).toEqual(["git.account.git-github.account", "git.account.git-azure-devops.account"]);
    expect([page.find(".mark").getAttribute("aria-hidden"), page.find(".mark").style.backgroundColor]).toEqual(["true", "rgb(36, 41, 47)"]);
    expect([page.texts("h2"), page.texts(".intro")]).toEqual([["Accounts and hosts", "What each host can do"],
      ["Tokens stay in the system's secure store. Each host's features appear only where that host has them."]]);
  });

  it("opens the host's sign-in in a dialog titled for it, under the host's own context, from a card's sign-in button, and closes it when dismissed", async () => {
    provide(github, accountOf("git-github.account", "GitHub", "GH", signal([signedOut]), [GitHostFeature.PullRequests]));
    const page: Page = new Page();
    await page.fixture.whenStable();

    await page.clickAsync(page.find(".card button[nol-button]"));
    await page.untilAsync(() => !Object.isNull(page.dialog()?.querySelector(".test-sign-in")));
    const title: string[] = page.texts(".nol-dialog-title", document);
    await page.closeDialogAsync();

    expect([title, signInContexts]).toEqual([["Sign in to GitHub"], [github]]);
    expect(signInContexts[0]).toBe(github);
  });

  it("opens the host's account in a dialog titled for the account from a signed-in card's manage button", async () => {
    provide(azure, accountOf("git-azure-devops.account", "Azure DevOps", "Az", signal([signedIn]), [GitHostFeature.PullRequests]));
    const page: Page = new Page();
    await page.fixture.whenStable();

    await page.clickAsync(page.find(".card button[nol-icon-button]"));
    await page.untilAsync(() => !Object.isNull(page.dialog()?.querySelector(".test-sign-in")));
    const title: string[] = page.texts(".nol-dialog-title", document);
    await page.closeDialogAsync();

    expect([title, signInContexts]).toEqual([["Azure DevOps account"], [azure]]);
    expect(signInContexts[0]).toBe(azure);
  });

  it("lists each host under Add an account, and opens the sign-in of the one chosen", async () => {
    provide(github, accountOf("git-github.account", "GitHub", "GH", signal([signedOut]), [GitHostFeature.PullRequests]));
    provide(azure, accountOf("git-azure-devops.account", "Azure DevOps", "Az", signal([signedIn]), [GitHostFeature.PullRequests]));
    const page: Page = new Page();
    await page.fixture.whenStable();
    const rows = (): HTMLElement[] => [...document.querySelectorAll<HTMLElement>("button[nol-menu-item]")];

    const add: HTMLElement = page.find(".add");
    await page.clickAsync(add);
    await page.untilAsync(() => rows().length > 0);
    const listed: string[] = rows().map(t => t.textContent?.trim() ?? "");
    const chosen: HTMLElement | undefined = rows()[1];
    if (Object.isUndefined(chosen))
      throw new Error("The menu has no second row.");
    await page.clickAsync(chosen);
    await page.untilAsync(() => !Object.isNull(page.dialog()?.querySelector(".test-sign-in")));
    const title: string[] = page.texts(".nol-dialog-title", document);
    await page.closeDialogAsync();

    expect([add.textContent?.trim(), add.hasAttribute("disabled")]).toEqual(["addAdd an account", false]);
    expect([listed, title]).toEqual([["GitHub", "Azure DevOps"], ["Sign in to Azure DevOps"]]);
    expect(signInContexts[0]).toBe(azure);
  });

  it("shows which features each host lists, one row per feature, with each answer said in words", async () => {
    provide(github, accountOf("git-github.account", "GitHub", "GH", signal([signedOut]), [GitHostFeature.PullRequests, GitHostFeature.BuildsOnCommits]));
    provide(azure, accountOf("git-azure-devops.account", "Azure DevOps", "Az", signal([signedIn]), [GitHostFeature.PullRequests, GitHostFeature.WorkItems]));
    const page: Page = new Page();
    await page.fixture.whenStable();

    const rows: string[][] = [...page.element.querySelectorAll("[role=row]")].map(t => [...t.children].map(u =>
      u.classList.contains("answer") ? `${u.classList.contains("yes") ? "yes" : "no"} ${page.texts(".material-symbols-rounded", u).join()} ${page.texts(".answer-text", u).join()}`
        : u.textContent?.trim() ?? ""));

    expect(page.find("[role=table]").style.getPropertyValue("--git-host-columns")).toBe("2");
    expect(rows).toEqual([
      ["", "GitHub", "Azure"],
      ["Pull requests", "yes check Yes", "yes check Yes"],
      ["Votes and policies", "no remove No", "no remove No"],
      ["Builds on commits", "yes check Yes", "no remove No"],
      ["Work items", "no remove No", "yes check Yes"],
      ["Branch from item", "no remove No", "no remove No"],
      ["Auto-complete", "no remove No", "no remove No"]
    ]);
  });

  it("says no host module is on, with Add an account off and no host's column, while no host gives an account", async () => {
    const page: Page = new Page();
    await page.fixture.whenStable();

    expect([page.element.querySelectorAll(".host, .card").length, page.texts(".intro")[1], page.find(".add").hasAttribute("disabled")])
      .toEqual([0, "No host module is on, so there is no account to add.", true]);
    expect([page.texts("[role=columnheader]"), page.element.querySelectorAll("[role=cell]").length]).toEqual([[""], 0]);
  });
});
