/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { signal, type WritableSignal } from "@angular/core";
import { ContentPadding, type IWindowPart, type IWindowPartContext, WindowException } from "@noldova/desktop.window";
import { GitHubNames } from "@noldova/git.github.protocol";
import { HostSignIn } from "@noldova/git.hosting.protocol";
import type { GitRemote } from "@noldova/git.protocol";
import { GitAvatars, GitHostAccounts, GitHostCard, GitHostCardState, GitHostFeature, GitHostRows, GitLinkReferences, GitPullRequests } from "@noldova/git.window";

import { GitHubHostRowComponent } from "../components/github-host-row/github-host-row.component.ts";
import { GitHubSignInComponent } from "../components/github-sign-in/github-sign-in.component.ts";
import { Resources } from "../../resources.ts";
import { GitHubAuthorAvatars } from "./github-author-avatars.ts";
import { GitHubPullRequests } from "./github-pull-requests.ts";
import { GitHubReferenceSource } from "./github-reference-source.ts";
import { SignInEvents } from "./sign-in-events.ts";

export class GitHubWindowPart implements IWindowPart {
  private context: IWindowPartContext | null = null;
  private withdraw: (() => void) | null = null;
  private withdrawAccount: (() => void) | null = null;
  private readonly cards: WritableSignal<readonly GitHostCard[]> = signal(GitHubWindowPart.cardsFor(null));
  private unfollow: (() => void) | null = null;
  private withdrawLinks: (() => void) | null = null;
  private changes: number = 0;

  public readonly moduleId: string = GitHubNames.moduleId;
  public readonly padding: ContentPadding = ContentPadding.None;

  public get isActive(): boolean {
    return this.context !== null;
  }

  public async activateAsync(context: IWindowPartContext): Promise<void> {
    const withdrawRows = GitHostRows.provide(context, { claims: (remote: GitRemote) => remote.host === Resources.gitHubHost, component: GitHubHostRowComponent });
    const withdrawPullRequests = GitPullRequests.provide(context, new GitHubPullRequests(context));
    this.withdraw = () => {
      withdrawRows();
      withdrawPullRequests();
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
    this.cards.set(GitHubWindowPart.cardsFor(null));
    this.withdrawAccount = GitHostAccounts.provide(context, { id: Resources.accountId, host: Resources.hostName, column: Resources.hostColumn, mark: Resources.hostMark, markColor: Resources.hostColor,
      cards: this.cards.asReadonly(), signIn: GitHubSignInComponent, features: [GitHostFeature.PullRequests, GitHostFeature.BuildsOnCommits] });
    this.unfollow = SignInEvents.follow(context, signIn => {
      this.changes++;
      this.showCards(context, GitHubWindowPart.cardsFor(signIn));
    });
    void this.readCardsAsync(context);
  }

  public async reconnectAsync(): Promise<boolean> {
    return this.context !== null;
  }

  public async deactivateAsync(): Promise<void> {
    this.withdraw?.();
    this.withdraw = null;
    this.withdrawAccount?.();
    this.withdrawAccount = null;
    this.withdrawLinks?.();
    this.withdrawLinks = null;
    this.unfollow?.();
    this.unfollow = null;
    this.context = null;
  }

  private static cardsFor(signIn: HostSignIn | null): GitHostCard[] {
    const account = signIn?.account ?? null;
    if (account !== null)
      return [new GitHostCard(Resources.formatAccountTitle(account.login), Resources.formatAccess(account.scopes), GitHostCardState.SignedIn, Resources.signedIn)];
    const code = signIn?.deviceCode ?? null;
    if (code !== null)
      return [new GitHostCard(Resources.hostName, Resources.formatCodeNote(code.verificationUri, code.userCode, false), GitHostCardState.Waiting, Resources.waiting)];
    return [new GitHostCard(Resources.hostName, Resources.signedOutNote, GitHostCardState.SignedOut, Resources.signInAction)];
  }

  private static unreadCards(): GitHostCard[] {
    return [new GitHostCard(Resources.hostName, Resources.signInUnread, GitHostCardState.Failed, Resources.signInAction)];
  }

  private async readCardsAsync(context: IWindowPartContext): Promise<void> {
    const changes: number = this.changes;
    let signIn: HostSignIn;
    try {
      signIn = HostSignIn.fromJson(await context.requestAsync(GitHubNames.readSignInMethod, null));
    }
    catch (error) {
      if (!(error instanceof WindowException))
        throw error;
      context.log(Resources.formatRequestFailed(GitHubNames.readSignInMethod, String(error)));
      if (this.changes === changes)
        this.showCards(context, GitHubWindowPart.unreadCards());
      return;
    }
    if (this.changes === changes)
      this.showCards(context, GitHubWindowPart.cardsFor(signIn));
  }

  private showCards(context: IWindowPartContext, cards: GitHostCard[]): void {
    if (this.context === context)
      this.cards.set(cards);
  }
}
