/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Component, computed, DestroyRef, effect, inject, Injector, input, type InputSignal, PendingTasks, type Signal, signal, untracked, type WritableSignal } from "@angular/core";
import "@noldova/context.core";
import { type IWindowPartContext, RuntimeRequestException, WindowException, WindowPartTokens } from "@noldova/desktop.window";
import { AzureDevOpsNames } from "@noldova/git.azure-devops.protocol";
import type { JsonValue } from "@noldova/context.json";
import { HostPullRequest, HostPullRequestFiles, HostPullRequestUpdates, type HostReference, HostReviewer, HostSignIn, ReferenceState, SignInState }
  from "@noldova/git.hosting.protocol";
import { GitFolderParams, GitNames, GitPullParams, GitStatus } from "@noldova/git.protocol";
import { GitFileLine, GitFolder, GitPullRequestCommitsComponent, GitPullRequestConflictsComponent, GitPullRequestFilesComponent, GitPullRequestThreadsComponent,
  type ThreadLine } from "@noldova/git.window";
import { AvatarSize, ButtonComponent, ButtonVariant, type ILinkReferenceSource, type LinkOpenEvent, MenuComponent,
  MenuItemComponent, MenuSeparatorComponent, MenuTriggerDirective, SpinnerComponent } from "@noldova/ui.components.angular";
import { MarkdownViewComponent } from "@noldova/ui.components.angular/markdown";

import { PullRequestTab } from "../../enums/pull-request-tab.ts";
import { KeptPull } from "../../models/kept-pull.ts";
import type { PullAfter } from "../../models/pull-after.ts";
import { PullOutcome } from "../../models/pull-outcome.ts";
import { PullRequestChoice } from "../../models/pull-request-choice.ts";
import { PullRequestClone } from "../../models/pull-request-clone.ts";
import { PullRequestDocument } from "../../models/pull-request-document.ts";
import { TabSize } from "../../models/tab-size.ts";
import { WorkItemsPlace } from "../../models/work-items-place.ts";
import { AccountSettings } from "../../services/account-settings.ts";
import { AzureDevOpsPages } from "../../services/azure-devops-pages.ts";
import { AzureDevOpsPullRequestHost } from "../../services/azure-devops-pull-request-host.ts";
import { AzureDevOpsReferenceSource } from "../../services/azure-devops-reference-source.ts";
import { PullRequestPages } from "../../services/pull-request-pages.ts";
import { PullRequestSelection } from "../../services/pull-request-selection.ts";
import { SignInEvents } from "../../services/sign-in-events.ts";
import { AzureDevOpsPullRequestUpdatesComponent } from "../azure-devops-pull-request-updates/azure-devops-pull-request-updates.component.ts";
import { AzureDevOpsPersonAvatarComponent } from "../azure-devops-person-avatar/azure-devops-person-avatar.component.ts";
import { Resources } from "../../../resources.ts";

@Component({
  selector: "nol-git-azure-devops-pull-request",
  templateUrl: "./azure-devops-pull-request.component.html",
  styleUrl: "./azure-devops-pull-request.component.css",
  imports: [AzureDevOpsPersonAvatarComponent, AzureDevOpsPullRequestUpdatesComponent, ButtonComponent, GitPullRequestCommitsComponent,
    GitPullRequestConflictsComponent, GitPullRequestFilesComponent, GitPullRequestThreadsComponent, MarkdownViewComponent, MenuComponent, MenuItemComponent,
    MenuSeparatorComponent, MenuTriggerDirective, SpinnerComponent]
})
export class AzureDevOpsPullRequestComponent {
  private readonly context: IWindowPartContext = inject(WindowPartTokens.context);
  private readonly tasks: PendingTasks = inject(PendingTasks);
  private readonly attempt: WritableSignal<number> = signal<number>(0);

  protected readonly host: AzureDevOpsPullRequestHost = new AzureDevOpsPullRequestHost(this.context);
  private readonly dates: Intl.DateTimeFormat = new Intl.DateTimeFormat(undefined, Resources.openDateFormat);
  private readonly votes: WritableSignal<ReadonlyMap<string, HostReviewer>> = signal<ReadonlyMap<string, HostReviewer>>(new Map());
  private readonly login: WritableSignal<string | null> = signal<string | null>(null);
  private loginChanges: number = 0;
  private generation: number = 0;
  private pullAfter: KeptPull | null = null;
  private references: AzureDevOpsReferenceSource | null = null;
  private revealing: ThreadLine | null = null;
  private readonly readAt: WritableSignal<number> = signal<number>(0);

  protected readonly resources: typeof Resources = Resources;
  protected readonly secondary: ButtonVariant = ButtonVariant.Secondary;
  protected readonly small: AvatarSize = AvatarSize.Small;
  protected readonly reference: Signal<HostReference | null> = computed(() => PullRequestDocument.referenceOf(this.instance()));
  protected readonly pullRequest: WritableSignal<HostPullRequest | null> = signal<HostPullRequest | null>(null);
  protected readonly isMissing: WritableSignal<boolean> = signal<boolean>(false);
  protected readonly failure: WritableSignal<string | null> = signal<string | null>(null);
  protected readonly isReading: WritableSignal<boolean> = signal<boolean>(true);
  protected readonly isSignedOut: WritableSignal<boolean> = signal<boolean>(false);
  protected readonly isVoting: WritableSignal<boolean> = signal<boolean>(false);
  protected readonly voteFailure: WritableSignal<string | null> = signal<string | null>(null);
  protected readonly pendingVote: WritableSignal<number | null> = signal<number | null>(null);
  protected readonly pullNote: WritableSignal<string | null> = signal<string | null>(null);
  protected readonly pullFailure: WritableSignal<string | null> = signal<string | null>(null);
  protected readonly overviewTab: PullRequestTab = PullRequestTab.Overview;
  protected readonly updatesTab: PullRequestTab = PullRequestTab.Updates;
  protected readonly commitsTab: PullRequestTab = PullRequestTab.Commits;
  protected readonly filesTab: PullRequestTab = PullRequestTab.Files;
  protected readonly conflictsTab: PullRequestTab = PullRequestTab.Conflicts;
  protected readonly tab: WritableSignal<PullRequestTab> = signal<PullRequestTab>(PullRequestTab.Overview);
  protected readonly opened: WritableSignal<ReadonlySet<PullRequestTab>> = signal<ReadonlySet<PullRequestTab>>(new Set());
  protected readonly counts: WritableSignal<ReadonlyMap<PullRequestTab, string>> = signal<ReadonlyMap<PullRequestTab, string>>(new Map());
  protected readonly files: WritableSignal<HostPullRequestFiles | null | undefined> = signal<HostPullRequestFiles | null | undefined>(undefined);
  protected readonly reveal: WritableSignal<GitFileLine | null> = signal<GitFileLine | null>(null);
  protected readonly updates: WritableSignal<HostPullRequestUpdates | null | undefined> = signal<HostPullRequestUpdates | null | undefined>(undefined);

  private readonly choice: Signal<PullRequestChoice | null> = computed(() => {
    const pullRequest: HostPullRequest | null = this.pullRequest();
    return Object.isNull(pullRequest) ? null : new PullRequestChoice(pullRequest, this.reviewersOf(pullRequest), this.readAt(), {
      changed: pull => this.changed(pullRequest.item.reference, pull),
      added: reviewer => this.addReviewer(reviewer)
    });
  });

  public readonly instance: InputSignal<string> = input.required<string>();

  public constructor() {
    const active: Signal<boolean> = inject(WindowPartTokens.activeDocument);
    PullRequestSelection.of(this.context).follow(this.choice, active, inject(Injector));
    inject(DestroyRef).onDestroy(PullRequestPages.follow(this.instance, active));
    inject(DestroyRef).onDestroy(SignInEvents.follow(this.context, signIn => {
      if (signIn.state === SignInState.Waiting)
        return;
      this.loginChanges++;
      this.login.set(signIn.account?.login ?? null);
      this.isSignedOut.set(signIn.state === SignInState.SignedOut);
      this.retry();
    }));
    effect(onCleanup => {
      this.attempt();
      const reference: HostReference | null = this.reference();
      const isSignedOut: boolean = this.isSignedOut();
      let isCurrent = true;
      onCleanup(() => {
        isCurrent = false;
      });
      untracked(() => {
        this.generation++;
        this.votes.set(new Map());
        this.isVoting.set(false);
        this.voteFailure.set(null);
        this.pendingVote.set(null);
        this.pullNote.set(null);
        this.pullFailure.set(null);
        this.tab.set(PullRequestTab.Overview);
        this.opened.set(new Set());
        this.counts.set(new Map());
        this.files.set(undefined);
        this.updates.set(undefined);
        this.reveal.set(null);
        this.revealing = null;
        this.pullRequest.set(null);
        this.failure.set(null);
        this.isMissing.set(!isSignedOut && Object.isNull(reference));
        this.isReading.set(!isSignedOut && !Object.isNull(reference));
        if (!isSignedOut && !Object.isNull(reference))
          void this.readAsync(reference, () => isCurrent);
      });
    });
    void this.readLoginAsync();
  }

  protected retry(): void {
    this.attempt.update(t => t + 1);
  }

  protected signIn(): void {
    AccountSettings.open(this.context);
  }

  private changed(reference: HostReference, pull: PullAfter | null): void {
    this.pullAfter = Object.isNull(pull) ? null : new KeptPull(JSON.stringify(reference.toJson()), pull);
    this.retry();
  }

  protected show(tab: PullRequestTab): void {
    this.tab.set(tab);
    this.opened.update(t => new Set([...t, tab]));
  }

  protected goToLine(pullRequest: HostPullRequest, target: ThreadLine): void {
    void this.goToLineAsync(pullRequest, target);
  }

  private async goToLineAsync(pullRequest: HostPullRequest, target: ThreadLine): Promise<void> {
    const generation: number = this.generation;
    const done = this.tasks.add();
    try {
      const folder: string | null = await this.host.localFolderAsync(pullRequest.item.url);
      if (generation !== this.generation)
        return;
      if (Object.isNull(folder)) {
        await this.openThreadAsync(pullRequest, target);
        return;
      }
      this.revealing = target;
      this.reveal.set(new GitFileLine(target.path.replace(Resources.leadingSlashPattern, ""), target.line));
      this.show(PullRequestTab.Files);
    }
    finally {
      done();
    }
  }

  protected unrevealed(pullRequest: HostPullRequest): void {
    const target: ThreadLine | null = this.revealing;
    if (!Object.isNull(target))
      void this.openThreadAsync(pullRequest, target);
  }

  private async openThreadAsync(pullRequest: HostPullRequest, target: ThreadLine): Promise<void> {
    await this.openAsync(Resources.formatThreadPage(pullRequest.item.url, target.path, target.threadId));
  }

  protected count(tab: PullRequestTab, count: string): void {
    this.counts.update(t => new Map([...t, [tab, count]]));
  }

  protected commitBadgeOf(pullRequest: HostPullRequest): string | null {
    return this.counts().get(PullRequestTab.Commits) ?? (Object.isNull(pullRequest.commitCount) ? null : String(pullRequest.commitCount));
  }

  protected openedOf(pullRequest: HostPullRequest): string {
    return Resources.formatOpened(this.dates.format(pullRequest.item.createdAt));
  }

  private reviewersOf(pullRequest: HostPullRequest): readonly HostReviewer[] {
    const votes: ReadonlyMap<string, HostReviewer> = this.votes();
    const logins: ReadonlySet<string> = new Set(pullRequest.reviewers.map(t => t.person.login));
    return [...pullRequest.reviewers.map(t => votes.get(t.person.login) ?? t), ...[...votes.values()].filter(t => !logins.has(t.person.login))];
  }

  protected voteNoteOf(pullRequest: HostPullRequest): string {
    const login: string | null = this.login();
    if (Object.isNull(login))
      return Resources.votesGoAsYou;
    const own: HostReviewer | undefined = this.reviewersOf(pullRequest).find(t => t.person.login.toLowerCase() === login.toLowerCase());
    return Resources.formatYourVote(Object.isUndefined(own) || own.vote === 0 ? Resources.ownVoteNone : own.voteLabel);
  }

  private addReviewer(reviewer: HostReviewer): void {
    this.votes.update(t => new Map([...t, [reviewer.person.login, reviewer]]));
  }

  protected chooseVote(pullRequest: HostPullRequest, vote: number): void {
    if (pullRequest.isAutoComplete && vote > 0) {
      this.pendingVote.set(vote);
      return;
    }
    void this.voteAsync(pullRequest.item.reference, vote);
  }

  protected confirmVote(reference: HostReference, vote: number): void {
    this.pendingVote.set(null);
    void this.voteAsync(reference, vote);
  }

  protected cancelVote(): void {
    this.pendingVote.set(null);
  }

  private async voteAsync(reference: HostReference, vote: number): Promise<void> {
    const generation: number = this.generation;
    const finished = this.tasks.add();
    this.isVoting.set(true);
    this.voteFailure.set(null);
    try {
      const reviewer: HostReviewer = HostReviewer.fromJson(await this.context.requestAsync(AzureDevOpsNames.voteMethod, { reference: reference.toJson(), vote }));
      if (generation === this.generation)
        this.votes.update(t => new Map([...t, [reviewer.person.login, reviewer]]));
    }
    catch (error) {
      if (!(error instanceof WindowException))
        throw error;
      this.context.log(Resources.formatRequestFailed(AzureDevOpsNames.voteMethod, String(error)));
      if (generation === this.generation)
        this.voteFailure.set(error instanceof RuntimeRequestException ? error.message : Resources.writeUnanswered);
    }
    finally {
      if (generation === this.generation)
        this.isVoting.set(false);
      finished();
    }
  }

  protected referencesOf(pullRequest: HostPullRequest): ILinkReferenceSource {
    this.references ??= AzureDevOpsReferenceSource.register(this.context);
    return this.references.readerFor(pullRequest.item.reference.owner);
  }

  protected openLink(pullRequest: HostPullRequest, opened: LinkOpenEvent): void {
    if (!AzureDevOpsPages.open(this.context, WorkItemsPlace.ofPage(pullRequest.item.url), opened.url))
      void this.openAsync(opened.url, opened.gesture);
  }

  protected async openAsync(url: string, gesture?: LinkOpenEvent["gesture"]): Promise<void> {
    try {
      await this.context.openLinkAsync(url, Object.isUndefined(gesture) ? undefined : { gesture });
    }
    catch (error) {
      if (!(error instanceof WindowException))
        throw error;
      this.context.log(Resources.formatLinkFailed(url, String(error)));
    }
  }

  private async readLoginAsync(): Promise<void> {
    const done = this.tasks.add();
    try {
      const changes: number = this.loginChanges;
      const login: string | null = HostSignIn.fromJson(await this.context.requestAsync(AzureDevOpsNames.readSignInMethod, null)).account?.login ?? null;
      if (this.loginChanges === changes)
        this.login.set(login);
    }
    catch (error) {
      if (!(error instanceof WindowException))
        throw error;
      this.context.log(Resources.formatRequestFailed(AzureDevOpsNames.readSignInMethod, String(error)));
    }
    finally {
      done();
    }
  }

  private async readAsync(reference: HostReference, isCurrent: () => boolean): Promise<void> {
    const done = this.tasks.add();
    try {
      const answer = await this.context.requestAsync(AzureDevOpsNames.readPullRequestMethod, reference.toJson());
      const pullRequest: HostPullRequest | null = Object.isNull(answer) ? null : HostPullRequest.fromJson(answer);
      if (isCurrent()) {
        this.readAt.set(Date.now());
        this.pullRequest.set(pullRequest);
        this.isMissing.set(Object.isNull(pullRequest));
        this.pullIfMerged(reference, pullRequest);
        if (!Object.isNull(pullRequest))
          this.readTabsEarly(reference, isCurrent);
      }
    }
    catch (error) {
      if (!(error instanceof WindowException))
        throw error;
      this.context.log(Resources.formatRequestFailed(AzureDevOpsNames.readPullRequestMethod, String(error)));
      if (isCurrent())
        this.failure.set(Resources.pullRequestUnanswered);
    }
    finally {
      if (isCurrent())
        this.isReading.set(false);
      done();
    }
  }

  private readTabsEarly(reference: HostReference, isCurrent: () => boolean): void {
    void this.readEarlyAsync(this.host.readChangesMethod, reference, t => HostPullRequestFiles.fromJson(t), this.files, PullRequestTab.Files,
      t => new TabSize(t.files.length, t.hasMore), isCurrent);
    void this.readEarlyAsync(AzureDevOpsNames.readPullRequestUpdatesMethod, reference, t => HostPullRequestUpdates.fromJson(t), this.updates, PullRequestTab.Updates,
      t => new TabSize(t.updates.length, t.hasMore), isCurrent);
  }

  private async readEarlyAsync<T>(method: string, reference: HostReference, parse: (answer: JsonValue) => T, held: WritableSignal<T | null | undefined>,
    tab: PullRequestTab, sizeOf: (read: T) => TabSize, isCurrent: () => boolean): Promise<void> {
    const done = this.tasks.add();
    try {
      const read: T = parse(await this.context.requestAsync(method, reference.toJson()));
      if (isCurrent()) {
        const counted: TabSize = sizeOf(read);
        held.set(read);
        this.count(tab, `${counted.size}${counted.hasMore ? Resources.moreMark : ""}`);
      }
    }
    catch (error) {
      if (!(error instanceof WindowException))
        throw error;
      this.context.log(Resources.formatRequestFailed(method, String(error)));
      if (isCurrent())
        held.set(null);
    }
    finally {
      done();
    }
  }

  private pullIfMerged(reference: HostReference, pullRequest: HostPullRequest | null): void {
    const pending = this.pullAfter;
    if (Object.isNull(pending) || pending.key !== JSON.stringify(reference.toJson()))
      return;
    this.pullAfter = null;
    if (pullRequest?.item.state === ReferenceState.Merged)
      void this.pullAsync(pending.pull, pullRequest.item.url);
    else
      this.pullNote.set(Resources.formatPullNotMerged(pending.pull.branch));
  }

  private async pullAsync(pull: PullAfter, url: string): Promise<void> {
    const generation: number = this.generation;
    const done = this.tasks.add();
    try {
      const outcome: PullOutcome = await this.pullOutcomeAsync(pull, url);
      if (generation === this.generation) {
        this.pullNote.set(outcome.note);
        this.pullFailure.set(outcome.failure);
      }
    }
    finally {
      done();
    }
  }

  private async pullOutcomeAsync(pull: PullAfter, url: string): Promise<PullOutcome> {
    if (GitFolder.folder() !== pull.folder)
      return new PullOutcome(null, Resources.formatPullFolderChanged(pull.branch));
    let method: string = GitNames.statusMethod;
    try {
      const status: GitStatus = GitStatus.fromJson(await this.context.requestAsync(method, new GitFolderParams(pull.folder).toJson()));
      if (!PullRequestClone.isPullTarget(status, url, pull.branch))
        return new PullOutcome(null, Resources.formatPullMoved(pull.branch));
      method = GitNames.pullMethod;
      await this.context.requestAsync(method, new GitPullParams(pull.folder, status.fingerprint).toJson());
      return new PullOutcome(Resources.formatPulled(pull.branch), null);
    }
    catch (error) {
      if (!(error instanceof WindowException))
        throw error;
      this.context.log(Resources.formatRequestFailed(method, String(error)));
      return new PullOutcome(null, error instanceof RuntimeRequestException ? error.message : Resources.formatPullUnanswered(pull.branch));
    }
  }
}
