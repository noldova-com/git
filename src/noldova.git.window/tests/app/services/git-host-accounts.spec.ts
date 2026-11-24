/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Component, signal } from "@angular/core";
import { FakeWindowPartContext } from "@noldova/desktop.window/testing";
import { describe, expect, it } from "vitest";

import { GitHostFeature } from "../../../src/app/enums/git-host-feature.ts";
import type { IGitHostAccount } from "../../../src/app/interfaces/i-git-host-account.ts";
import type { IProvidedGitHostAccount } from "../../../src/app/interfaces/i-provided-git-host-account.ts";
import { GitHostAccounts } from "../../../src/app/services/git-host-accounts.ts";

@Component({ selector: "nol-git-test-sign-in", template: "" })
class TestSignInComponent {
}

function accountOf(id: string, host: string): IGitHostAccount {
  return { id, host, column: host, mark: host.slice(0, 2), markColor: "#000000", cards: signal([]), signIn: TestSignInComponent, features: [GitHostFeature.PullRequests] };
}

describe("GitHostAccounts", () => {
  const github: IGitHostAccount = accountOf("git-github.account", "GitHub");
  const azure: IGitHostAccount = accountOf("git-azure-devops.account", "Azure DevOps");

  it("gives each account in the order it was provided, with the context that provided it, until it is withdrawn, once", () => {
    const first: FakeWindowPartContext = new FakeWindowPartContext();
    const second: FakeWindowPartContext = new FakeWindowPartContext();

    const before: readonly IProvidedGitHostAccount[] = GitHostAccounts.accounts();
    const withdrawGitHub: () => void = GitHostAccounts.provide(first, github);
    const withdrawAzure: () => void = GitHostAccounts.provide(second, azure);
    const both: readonly IProvidedGitHostAccount[] = GitHostAccounts.accounts();
    withdrawGitHub();
    withdrawGitHub();
    const afterWithdraw: readonly IProvidedGitHostAccount[] = GitHostAccounts.accounts();
    withdrawAzure();

    expect(before).toEqual([]);
    expect(both.map(t => [t.context, t.account])).toEqual([[first, github], [second, azure]]);
    expect(both[0]?.context).toBe(first);
    expect(afterWithdraw.map(t => t.account)).toEqual([azure]);
    expect(GitHostAccounts.accounts()).toEqual([]);
  });

  it("keeps an account provided twice apart, so withdrawing one leaves the other", () => {
    const context: FakeWindowPartContext = new FakeWindowPartContext();

    const withdrawFirst: () => void = GitHostAccounts.provide(context, github);
    const withdrawSecond: () => void = GitHostAccounts.provide(context, github);
    withdrawFirst();
    const left: number = GitHostAccounts.accounts().length;
    withdrawSecond();

    expect([left, GitHostAccounts.accounts().length]).toEqual([1, 0]);
  });

  it("tells a follower the accounts at once and on each change, until it unfollows", () => {
    const context: FakeWindowPartContext = new FakeWindowPartContext();
    const seen: string[][] = [];
    const other: string[][] = [];

    const unfollow: () => void = GitHostAccounts.follow(t => seen.push(t.map(u => u.account.host)));
    const unfollowOther: () => void = GitHostAccounts.follow(t => other.push(t.map(u => u.account.host)));
    const withdrawGitHub: () => void = GitHostAccounts.provide(context, github);
    const withdrawAzure: () => void = GitHostAccounts.provide(context, azure);
    unfollow();
    withdrawGitHub();
    withdrawAzure();
    unfollowOther();
    unfollow();

    expect(seen).toEqual([[], ["GitHub"], ["GitHub", "Azure DevOps"]]);
    expect(other).toEqual([[], ["GitHub"], ["GitHub", "Azure DevOps"], ["Azure DevOps"], []]);
  });

  it("tells every follower of a change, even when one unfollows while it is told", () => {
    const context: FakeWindowPartContext = new FakeWindowPartContext();
    const seen: number[] = [];
    let unfollowFirst: () => void = () => undefined;

    unfollowFirst = GitHostAccounts.follow(t => {
      if (t.length > 0)
        unfollowFirst();
    });
    const unfollowSecond: () => void = GitHostAccounts.follow(t => seen.push(t.length));
    const withdraw: () => void = GitHostAccounts.provide(context, github);
    withdraw();
    unfollowSecond();

    expect(seen).toEqual([0, 1, 0]);
  });
});
