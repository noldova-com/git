/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { type Injector, signal, type WritableSignal } from "@angular/core";
import { ArgumentException } from "@noldova/context.exceptions";
import { JsonReader, type JsonValue } from "@noldova/context.json";
import { NotificationPost, NotificationSeverity, QualifiedName } from "@noldova/desktop.protocol";
import { CommandContribution, ContentPadding, DockSide, DocumentContribution, type IWindowPart, type IWindowPartContext, ViewContribution, WindowException }
  from "@noldova/desktop.window";
import { AzureDevOpsNames } from "@noldova/git.azure-devops.protocol";
import { HostSignIn } from "@noldova/git.hosting.protocol";
import { GitFolderParams, GitNames, type GitRemote, GitStatus } from "@noldova/git.protocol";
import { GitAvatars, GitFolder, GitHostAccounts, GitHostCard, GitHostCardState, GitHostFeature, GitHostRows, GitLinkReferences, GitPullRequests,
  GitRepositoryLinks } from "@noldova/git.window";

import { AzureDevOpsHostRowComponent } from "../components/azure-devops-host-row/azure-devops-host-row.component.ts";
import { AzureDevOpsSignInComponent } from "../components/azure-devops-sign-in/azure-devops-sign-in.component.ts";
import { AzureDevOpsRemote } from "../models/azure-devops-remote.ts";
import { BranchRequest } from "../models/branch-request.ts";
import { WorkItemsPlace } from "../models/work-items-place.ts";
import { Resources } from "../../resources.ts";
import { AzureDevOpsAuthorAvatars } from "./azure-devops-author-avatars.ts";
import { AzureDevOpsCommitPrefixes } from "./azure-devops-commit-prefixes.ts";
import { AzureDevOpsPages } from "./azure-devops-pages.ts";
import { AzureDevOpsPullRequests } from "./azure-devops-pull-requests.ts";
import { AzureDevOpsReferenceSource } from "./azure-devops-reference-source.ts";
import { AzureDevOpsRepositoryLinks } from "./azure-devops-repository-links.ts";
import { BranchDialog } from "./branch-dialog.ts";
import { PullRequestSelection } from "./pull-request-selection.ts";
import { SignInEvents } from "./sign-in-events.ts";
import { WorkItemSelection } from "./work-item-selection.ts";

export class AzureDevOpsWindowPart implements IWindowPart {
  private context: IWindowPartContext | null = null;
  private withdraw: (() => void) | null = null;
  private withdrawAccount: (() => void) | null = null;
  private readonly cards: WritableSignal<readonly GitHostCard[]> = signal(AzureDevOpsWindowPart.cardsFor(null));
  private unfollow: (() => void) | null = null;
  private withdrawLinks: (() => void) | null = null;
  private changes: number = 0;

  private static readonly features: readonly GitHostFeature[] = [GitHostFeature.PullRequests, GitHostFeature.VotesAndPolicies, GitHostFeature.BuildsOnCommits,
    GitHostFeature.WorkItems, GitHostFeature.BranchFromItem, GitHostFeature.AutoComplete];

  public readonly moduleId: string = AzureDevOpsNames.moduleId;
  public readonly padding: ContentPadding = ContentPadding.None;

  public get isActive(): boolean {
    return this.context !== null;
  }

  public async activateAsync(context: IWindowPartContext): Promise<void> {
    context.registerDocument(new DocumentContribution(Resources.pullRequestDocument,
      () => import("../components/azure-devops-pull-request/azure-devops-pull-request.component.ts").then(t => t.AzureDevOpsPullRequestComponent),
      ContentPadding.None));
    context.registerDocument(new DocumentContribution(Resources.workItemsDocument,
      () => import("../components/azure-devops-work-item/azure-devops-work-item.component.ts").then(t => t.AzureDevOpsWorkItemComponent), ContentPadding.None));
    context.registerView(new ViewContribution(Resources.workItemView, Resources.workItemViewLabel, Resources.workItemViewIcon, DockSide.Right, false,
      () => import("../components/azure-devops-work-item-detail/azure-devops-work-item-detail.component.ts").then(t => t.AzureDevOpsWorkItemDetailComponent),
      ContentPadding.None, { hasInstances: true, defaultGroup: Resources.viewGroup, defaultOrder: Resources.workItemViewOrder }));
    context.registerView(new ViewContribution(Resources.pullRequestView, Resources.pullRequestLabel, Resources.pullRequestIcon, DockSide.Right, false,
      () => import("../components/azure-devops-pull-request-detail/azure-devops-pull-request-detail.component.ts").then(t => t.AzureDevOpsPullRequestDetailComponent),
      ContentPadding.None, { hasInstances: true, defaultGroup: Resources.viewGroup, defaultOrder: Resources.pullRequestViewOrder }));
    const withdrawClosed = WorkItemSelection.of(context).listen();
    const withdrawPullRequestClosed = PullRequestSelection.of(context).listen();
    context.registerCommand(AzureDevOpsWindowPart.openCommand(context, Resources.openWorkItemsCommand, Resources.openWorkItemsTitle, Resources.workItemsIcon,
      Resources.workItemsDocument, Resources.myWorkItemsTitle, Resources.noProjectForWorkItems));
    let references: AzureDevOpsReferenceSource | null = null;
    const withdrawPullRequests = GitPullRequests.provide(context, new AzureDevOpsPullRequests(context,
      (url, reference) => (references ??= AzureDevOpsReferenceSource.register(context)).rememberPage(url, reference)));
    const withdrawRows = GitHostRows.provide(context, { claims: (remote: GitRemote) => AzureDevOpsRemote.isAzureDevOps(remote), component: AzureDevOpsHostRowComponent });
    const withdrawRepositoryLinks = GitRepositoryLinks.provide(new AzureDevOpsRepositoryLinks(context));
    this.withdraw = () => {
      withdrawClosed();
      withdrawPullRequestClosed();
      withdrawRows();
      withdrawPullRequests();
      withdrawRepositoryLinks();
    };
    const withdrawLinks = GitLinkReferences.provide({
      referencesFor: folder => {
        references ??= AzureDevOpsReferenceSource.register(context);
        return references.readerFor(references.homeOf(folder)());
      },
      opens: (folder, url, injector) => AzureDevOpsWindowPart.opensBranch(context, folder, url, injector)
        || AzureDevOpsPages.open(context, references?.placeOf(folder) ?? null, url)
    });
    const withdrawPrefixes = AzureDevOpsCommitPrefixes.provide(context);
    const withdrawAvatars = GitAvatars.provide({
      avatarOf: (folder, email, commitId) => AzureDevOpsAuthorAvatars.register(context).avatarOf(folder, email, commitId)
    });
    this.withdrawLinks = () => {
      withdrawLinks();
      withdrawPrefixes();
      withdrawAvatars();
      AzureDevOpsAuthorAvatars.release(context);
      AzureDevOpsReferenceSource.release(context);
    };
    this.context = context;
    this.cards.set(AzureDevOpsWindowPart.cardsFor(null));
    this.withdrawAccount = GitHostAccounts.provide(context, { id: Resources.accountId, host: Resources.hostName, column: Resources.hostColumn, mark: Resources.hostMark,
      markColor: Resources.hostColor, cards: this.cards.asReadonly(), signIn: AzureDevOpsSignInComponent, features: AzureDevOpsWindowPart.features });
    this.unfollow = SignInEvents.follow(context, signIn => {
      this.changes++;
      this.showCards(context, AzureDevOpsWindowPart.cardsFor(signIn));
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

  private static opensBranch(context: IWindowPartContext, folder: string, url: string, injector: Injector): boolean {
    const request = BranchRequest.of(folder, url);
    if (Object.isNull(request))
      return false;
    BranchDialog.open(context, request, injector);
    return true;
  }

  private static cardsFor(signIn: HostSignIn | null): GitHostCard[] {
    const account = signIn?.account ?? null;
    if (account !== null)
      return [new GitHostCard(Resources.formatAccountTitle(account.login), Resources.formatAccountNote(account.login), GitHostCardState.SignedIn, Resources.signedInChip)];
    if (signIn?.address !== null && signIn?.address !== undefined)
      return [new GitHostCard(Resources.hostName, Resources.browserNote, GitHostCardState.Waiting, Resources.waiting)];
    return [new GitHostCard(Resources.hostName, Resources.signedOutNote, GitHostCardState.SignedOut, Resources.signInAction)];
  }

  private static unreadCards(): GitHostCard[] {
    return [new GitHostCard(Resources.hostName, Resources.signInUnread, GitHostCardState.Failed, Resources.signInAction)];
  }

  private async readCardsAsync(context: IWindowPartContext): Promise<void> {
    const changes: number = this.changes;
    let signIn: HostSignIn;
    try {
      signIn = HostSignIn.fromJson(await context.requestAsync(AzureDevOpsNames.readSignInMethod, null));
    }
    catch (error) {
      if (!(error instanceof WindowException))
        throw error;
      context.log(Resources.formatRequestFailed(AzureDevOpsNames.readSignInMethod, String(error)));
      if (this.changes === changes)
        this.showCards(context, AzureDevOpsWindowPart.unreadCards());
      return;
    }
    if (this.changes === changes)
      this.showCards(context, AzureDevOpsWindowPart.cardsFor(signIn));
  }

  private showCards(context: IWindowPartContext, cards: GitHostCard[]): void {
    if (this.context === context)
      this.cards.set(cards);
  }

  /**
   * A command that opens a document for the project its arguments name as `{ "instance": "organization/project" }`, or for the open repository's without them;
   * with no Azure DevOps repository open, it posts a notification that says so.
   */
  private static openCommand(context: IWindowPartContext, name: string, title: string, icon: string, document: string, documentTitle: string,
    missing: string): CommandContribution {
    return new CommandContribution(name, title, icon, null, async (commandArguments: JsonValue) => {
      const instance: string | null = commandArguments === null ? await AzureDevOpsWindowPart.openProjectAsync(context)
        : AzureDevOpsWindowPart.instanceOf(commandArguments);
      if (instance === null)
        await context.postNotificationAsync(new NotificationPost(QualifiedName.parse(Resources.noProjectNotification), name, missing, null, NotificationSeverity.Info,
          null, [], null));
      else
        context.openDocument(document, instance, documentTitle);
      return null;
    });
  }

  /** The open repository's project as a document instance; `null` with no repository open, a remote off Azure DevOps, or a status it can't read, which it logs. */
  private static async openProjectAsync(context: IWindowPartContext): Promise<string | null> {
    const folder: string | null = GitFolder.folder();
    if (folder === null)
      return null;
    try {
      const place: WorkItemsPlace | null = WorkItemsPlace.ofRemote(GitStatus.fromJson(await context.requestAsync(GitNames.statusMethod,
        new GitFolderParams(folder).toJson())).remote);
      return place === null ? null : Resources.formatWorkItemsInstance(place.organization, place.project, null);
    }
    catch (error) {
      if (!(error instanceof WindowException))
        throw error;
      context.log(Resources.formatRequestFailed(GitNames.statusMethod, String(error)));
      return null;
    }
  }

  private static instanceOf(commandArguments: JsonValue): string {
    const place: WorkItemsPlace | null = WorkItemsPlace.ofInstance(JsonReader.fromValue(commandArguments).readString(Resources.instanceArgument));
    if (place === null || place.id !== null)
      throw new ArgumentException(Resources.projectInstanceExpected, Resources.instanceArgument);
    return Resources.formatWorkItemsInstance(place.organization, place.project, null);
  }
}
