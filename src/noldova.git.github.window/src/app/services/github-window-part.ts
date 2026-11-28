/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { signal, type WritableSignal } from "@angular/core";
import "@noldova/context.core";
import { ContentPadding, type IWindowPart, type IWindowPartContext, WindowException } from "@noldova/desktop.window";
import { GitHubNames } from "@noldova/git.github.protocol";
import { HostAccountList, type HostSignIn } from "@noldova/git.hosting.protocol";
import type { GitRemote } from "@noldova/git.protocol";
import { GitAvatars, GitHostAccounts, GitHostCard, GitHostCardState, GitHostFeature, GitHostRows, GitLinkReferences, GitPullRequests } from "@noldova/git.window";

import { GitHubHostRowComponent } from "../components/github-host-row/github-host-row.component.ts";
import { GitHubAccountsComponent } from "../components/github-accounts/github-accounts.component.ts";
import { GitHubEnterpriseComponent } from "../components/github-enterprise/github-enterprise.component.ts";
import type { EnterpriseEntry } from "../models/enterprise-entry.ts";
import { Resources } from "../../resources.ts";
import { AccountEvents } from "./account-events.ts";
import { GitHubAccountList } from "./github-account-list.ts";
import { GitHubAuthorAvatars } from "./github-author-avatars.ts";
import { GitHubFolders } from "./github-folders.ts";
import { GitHubPullRequests } from "./github-pull-requests.ts";
import { GitHubReferenceSource } from "./github-reference-source.ts";

export class GitHubWindowPart implements IWindowPart {
  private context: IWindowPartContext | null = null;
  private withdraw: (() => void) | null = null;
  private withdrawAccount: (() => void) | null = null;
  private withdrawEnterprise: (() => void) | null = null;
  private readonly cards: WritableSignal<readonly GitHostCard[]> = signal(GitHubWindowPart.firstCards());
  private readonly enterpriseCards: WritableSignal<readonly GitHostCard[]> = signal(GitHubWindowPart.enterpriseCardsOf([]));
  private unfollow: (() => void) | null = null;
  private withdrawLinks: (() => void) | null = null;
  private changes: number = 0;

  public readonly moduleId: string = GitHubNames.moduleId;
  public readonly padding: ContentPadding = ContentPadding.None;

  public get isActive(): boolean {
    return !Object.isNull(this.context);
  }

  public async activateAsync(context: IWindowPartContext): Promise<void> {
    const accounts = GitHubAccountList.of(context);
    const withdrawRows = GitHostRows.provide(context, { claims: (remote: GitRemote) => GitHubAccountList.claims(accounts(), remote), component: GitHubHostRowComponent });
    const pullRequests = new GitHubPullRequests(context);
    const withdrawPullRequests = GitPullRequests.provide(context, pullRequests);
    this.withdraw = () => {
      withdrawRows();
      withdrawPullRequests();
      pullRequests.stop();
    };
    let references: GitHubReferenceSource | null = null;
    const withdrawLinks = GitLinkReferences.provide({
      referencesFor: folder => {
        references ??= GitHubReferenceSource.register(context);
        return references.readerFor(references.homeOf(folder)());
      }
    });
    let avatars: GitHubAuthorAvatars | null = null;
    const withdrawAvatars = GitAvatars.provide({
      avatarOf: (folder, email, commitId) => {
        avatars ??= new GitHubAuthorAvatars(context, () => references ??= GitHubReferenceSource.register(context));
        return avatars.avatarOf(folder, email, commitId);
      }
    });
    this.withdrawLinks = () => {
      withdrawLinks();
      withdrawAvatars();
      avatars?.stop();
      GitHubReferenceSource.release(context);
    };
    this.context = context;
    this.cards.set(GitHubWindowPart.firstCards());
    this.withdrawAccount = GitHostAccounts.provide(context, { id: Resources.accountId, host: Resources.hostName, column: Resources.hostColumn, mark: Resources.hostMark, markColor: Resources.hostColor,
      cards: this.cards.asReadonly(), signIn: GitHubAccountsComponent, features: [GitHostFeature.PullRequests, GitHostFeature.BuildsOnCommits] });
    this.withdrawEnterprise = GitHostAccounts.provide(context, { id: Resources.enterpriseAccountId, host: Resources.enterpriseHostName,
      column: Resources.enterpriseColumn, mark: Resources.hostMark, markColor: Resources.hostColor, cards: this.enterpriseCards.asReadonly(),
      signIn: GitHubEnterpriseComponent, features: [GitHostFeature.PullRequests, GitHostFeature.BuildsOnCommits] });
    this.unfollow = AccountEvents.follow(context, list => {
      this.changes++;
      this.showList(context, list);
    });
    void this.readCardsAsync(context);
  }

  public async reconnectAsync(): Promise<boolean> {
    if (Object.isNull(this.context))
      return false;
    GitHubFolders.forget(this.context);
    return true;
  }

  public async deactivateAsync(): Promise<void> {
    this.withdraw?.();
    this.withdraw = null;
    this.withdrawAccount?.();
    this.withdrawAccount = null;
    this.withdrawEnterprise?.();
    this.withdrawEnterprise = null;
    this.withdrawLinks?.();
    this.withdrawLinks = null;
    this.unfollow?.();
    this.unfollow = null;
    if (!Object.isNull(this.context)) {
      GitHubAccountList.show(this.context, null);
      GitHubFolders.forget(this.context);
    }
    this.context = null;
  }

  private static firstCards(): GitHostCard[] {
    return [GitHubWindowPart.cardOf(Resources.firstAccount, null)];
  }

  private static cardsOf(list: HostAccountList): GitHostCard[] {
    return list.accounts.map(t => GitHubWindowPart.cardOf(t.id, t.signIn));
  }

  private static enterpriseCardsOf(entries: readonly EnterpriseEntry[]): GitHostCard[] {
    if (entries.length === 0)
      return [new GitHostCard(Resources.enterpriseHostName, Resources.enterpriseCardNote, GitHostCardState.SignedOut, Resources.connectAction)];
    return entries.map(t => {
      const account = t.signIn.account;
      return Object.isNull(account)
        ? new GitHostCard(t.host, Resources.enterpriseCardNote, GitHostCardState.SignedOut, Resources.connectAction, String(t.id))
        : new GitHostCard(account.name ?? account.login, Resources.formatServerDetail(account.login, t.host), GitHostCardState.SignedIn, Resources.signedIn,
          String(t.id), account);
    });
  }

  private static cardOf(id: number, signIn: HostSignIn | null): GitHostCard {
    const account = signIn?.account ?? null;
    if (!Object.isNull(account))
      return new GitHostCard(account.name ?? account.login, Resources.formatAccountDetail(account), GitHostCardState.SignedIn, Resources.signedIn, String(id), account);
    const code = signIn?.deviceCode ?? null;
    if (!Object.isNull(code))
      return new GitHostCard(Resources.hostName, Resources.formatCodeNote(code.verificationUri, code.userCode, false), GitHostCardState.Waiting, Resources.waiting, String(id));
    return new GitHostCard(Resources.hostName, Resources.signedOutNote, GitHostCardState.SignedOut, Resources.signInAction, String(id));
  }

  private static unreadCards(): GitHostCard[] {
    return [new GitHostCard(Resources.hostName, Resources.signInUnread, GitHostCardState.Failed, Resources.signInAction, String(Resources.firstAccount))];
  }

  private async readCardsAsync(context: IWindowPartContext): Promise<void> {
    const changes: number = this.changes;
    let list: HostAccountList;
    try {
      list = HostAccountList.fromJson(await context.requestAsync(GitHubNames.readAccountsMethod, null));
    }
    catch (error) {
      if (!(error instanceof WindowException))
        throw error;
      context.log(Resources.formatRequestFailed(GitHubNames.readAccountsMethod, String(error)));
      if (this.changes === changes)
        this.showCards(context, GitHubWindowPart.unreadCards());
      return;
    }
    if (this.changes === changes)
      this.showList(context, list);
  }

  private showList(context: IWindowPartContext, list: HostAccountList): void {
    if (this.context !== context)
      return;
    const gitHub: HostAccountList = GitHubAccountList.gitHubOf(list);
    GitHubAccountList.show(context, gitHub);
    this.cards.set(GitHubWindowPart.cardsOf(gitHub));
    this.enterpriseCards.set(GitHubWindowPart.enterpriseCardsOf(GitHubAccountList.enterpriseOf(list)));
  }

  private showCards(context: IWindowPartContext, cards: GitHostCard[]): void {
    if (this.context === context)
      this.cards.set(cards);
  }
}
