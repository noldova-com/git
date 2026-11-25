/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Component, computed, effect, inject, Injector, input, type InputSignal, PendingTasks, type Signal, signal, untracked, type WritableSignal } from "@angular/core";
import { type IWindowPartContext, RuntimeRequestException, WindowException, WindowPartTokens } from "@noldova/desktop.window";
import { AzureDevOpsNames } from "@noldova/git.azure-devops.protocol";
import type { JsonValue } from "@noldova/context.json";
import { HostPullRequest, HostPullRequestFiles, HostPullRequestUpdates, type HostReference, HostReviewer, HostSignIn, ReferenceState }
  from "@noldova/git.hosting.protocol";
import { GitFolderParams, GitNames, GitPullParams, GitStatus } from "@noldova/git.protocol";
import { GitFileLine, GitFolder, GitPullRequestCommitsComponent, GitPullRequestConflictsComponent, GitPullRequestFilesComponent, GitPullRequestThreadsComponent,
  type ThreadLine } from "@noldova/git.window";
import { AvatarSize, ButtonComponent, ButtonVariant, type ILinkReferenceSource, type LinkOpenEvent, MenuComponent,
  MenuItemComponent, MenuSeparatorComponent, MenuTriggerDirective, SpinnerComponent } from "@noldova/ui.components.angular";
import { MarkdownViewComponent } from "@noldova/ui.components.angular/markdown";

import { PullRequestTab } from "../../enums/pull-request-tab.ts";
import { PullRequestChoice } from "../../models/pull-request-choice.ts";
import { PullRequestClone } from "../../models/pull-request-clone.ts";
import { PullRequestDocument } from "../../models/pull-request-document.ts";
import { WorkItemsPlace } from "../../models/work-items-place.ts";
import { AzureDevOpsPages } from "../../services/azure-devops-pages.ts";
import { AzureDevOpsPullRequestHost } from "../../services/azure-devops-pull-request-host.ts";
import { AzureDevOpsReferenceSource } from "../../services/azure-devops-reference-source.ts";
import { PullRequestSelection } from "../../services/pull-request-selection.ts";
import type { PullAfter } from "../../types/pull-after.ts";
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

  /** What the Commits, Files and Conflicts tabs read from Azure DevOps. */
  protected readonly host: AzureDevOpsPullRequestHost = new AzureDevOpsPullRequestHost(this.context);
  private readonly dates: Intl.DateTimeFormat = new Intl.DateTimeFormat(undefined, Resources.openDateFormat);
  private readonly votes: WritableSignal<ReadonlyMap<string, HostReviewer>> = signal<ReadonlyMap<string, HostReviewer>>(new Map());
  private readonly login: WritableSignal<string | null> = signal<string | null>(null);
  private generation: number = 0;
  private pullAfter: { readonly key: string; readonly pull: PullAfter } | null = null;
  private references: AzureDevOpsReferenceSource | null = null;
  /** The comment thread whose line the Files tab reveals, which the page shows on Azure DevOps when the tab can't. */
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
  /** The tab the page shows; a tab opened once keeps its answer while another shows. */
  protected readonly tab: WritableSignal<PullRequestTab> = signal<PullRequestTab>(PullRequestTab.Overview);
  protected readonly opened: WritableSignal<ReadonlySet<PullRequestTab>> = signal<ReadonlySet<PullRequestTab>>(new Set());
  protected readonly counts: WritableSignal<ReadonlyMap<PullRequestTab, string>> = signal<ReadonlyMap<PullRequestTab, string>>(new Map());
  /** The Files tab's files as the page read them once the pull request showed: `undefined` while that read runs, `null` when it failed, so the tab reads them. */
  protected readonly files: WritableSignal<HostPullRequestFiles | null | undefined> = signal<HostPullRequestFiles | null | undefined>(undefined);
  /** The line of a comment thread that the Files tab shows in its file's diff, or `null`. */
  protected readonly reveal: WritableSignal<GitFileLine | null> = signal<GitFileLine | null>(null);
  /** The Updates tab's pushes as the page read them once the pull request showed, as {@link files} holds the Files tab's. */
  protected readonly updates: WritableSignal<HostPullRequestUpdates | null | undefined> = signal<HostPullRequestUpdates | null | undefined>(undefined);

  /** The pull request as the Pull request view shows it, with the reviewers as the person's votes have them, while the page shows one. */
  private readonly choice: Signal<PullRequestChoice | null> = computed(() => {
    const pullRequest: HostPullRequest | null = this.pullRequest();
    return pullRequest === null ? null : new PullRequestChoice(pullRequest, this.reviewersOf(pullRequest), this.readAt(), {
      changed: pull => this.changed(pullRequest.item.reference, pull),
      added: reviewer => this.addReviewer(reviewer)
    });
  });

  /** The pull request's reference as the document's instance: `organization/repository/number`. */
  public readonly instance: InputSignal<string> = input.required<string>();

  public constructor() {
    PullRequestSelection.of(this.context).follow(this.choice, inject(WindowPartTokens.activeDocument), inject(Injector));
    effect(onCleanup => {
      this.attempt();
      const reference: HostReference | null = this.reference();
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
        this.isMissing.set(reference === null);
        this.isReading.set(reference !== null);
        if (reference !== null)
          void this.readAsync(reference, () => isCurrent);
      });
    });
    void this.readLoginAsync();
  }

  protected retry(): void {
    this.attempt.update(t => t + 1);
  }

  private changed(reference: HostReference, pull: PullAfter | null): void {
    this.pullAfter = pull === null ? null : { key: JSON.stringify(reference.toJson()), pull };
    this.retry();
  }

  protected show(tab: PullRequestTab): void {
    this.tab.set(tab);
    this.opened.update(t => new Set([...t, tab]));
  }

  /**
   * Shows a comment thread's line: in the Files tab's changes from local Git when the open repository is the pull request's, else on Azure DevOps, which the
   * page also falls back to when the tab can't show the line.
   */
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
      if (folder === null) {
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

  /** Shows on Azure DevOps the comment thread whose line the Files tab couldn't show, the only line the page gives the tab. */
  protected unrevealed(pullRequest: HostPullRequest): void {
    const target: ThreadLine | null = this.revealing;
    if (target !== null)
      void this.openThreadAsync(pullRequest, target);
  }

  private async openThreadAsync(pullRequest: HostPullRequest, target: ThreadLine): Promise<void> {
    await this.openAsync(Resources.formatThreadPage(pullRequest.item.url, target.path, target.threadId));
  }

  protected count(tab: PullRequestTab, count: string): void {
    this.counts.update(t => new Map([...t, [tab, count]]));
  }

  /** The Commits tab's count: the one it read, else the pull request's own, which Azure DevOps leaves out past 100. */
  protected commitBadgeOf(pullRequest: HostPullRequest): string | null {
    return this.counts().get(PullRequestTab.Commits) ?? (pullRequest.commitCount === null ? null : String(pullRequest.commitCount));
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
    if (login === null)
      return Resources.votesGoAsYou;
    const own: HostReviewer | undefined = this.reviewersOf(pullRequest).find(t => t.person.login.toLowerCase() === login.toLowerCase());
    return Resources.formatYourVote(own === undefined || own.vote === 0 ? Resources.ownVoteNone : own.voteLabel);
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
      await this.context.openLinkAsync(url, gesture === undefined ? undefined : { gesture });
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
      this.login.set(HostSignIn.fromJson(await this.context.requestAsync(AzureDevOpsNames.readSignInMethod, null)).account?.login ?? null);
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
      const pullRequest: HostPullRequest | null = answer === null ? null : HostPullRequest.fromJson(answer);
      if (isCurrent()) {
        this.readAt.set(Date.now());
        this.pullRequest.set(pullRequest);
        this.isMissing.set(pullRequest === null);
        this.pullIfMerged(reference, pullRequest);
        if (pullRequest !== null)
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

  /** Reads the Files and Updates tabs' answers in the background, so their counts show before they open and each tab shows the answer read here. */
  private readTabsEarly(reference: HostReference, isCurrent: () => boolean): void {
    void this.readEarlyAsync(this.host.readChangesMethod, reference, t => HostPullRequestFiles.fromJson(t), this.files, PullRequestTab.Files,
      t => [t.files.length, t.hasMore], isCurrent);
    void this.readEarlyAsync(AzureDevOpsNames.readPullRequestUpdatesMethod, reference, t => HostPullRequestUpdates.fromJson(t), this.updates, PullRequestTab.Updates,
      t => [t.updates.length, t.hasMore], isCurrent);
  }

  /** Reads one tab's answer and counts it; a failure only leaves the tab without a count, to read when it opens. */
  private async readEarlyAsync<T>(method: string, reference: HostReference, parse: (answer: JsonValue) => T, held: WritableSignal<T | null | undefined>,
    tab: PullRequestTab, sizeOf: (read: T) => readonly [number, boolean], isCurrent: () => boolean): Promise<void> {
    const done = this.tasks.add();
    try {
      const read: T = parse(await this.context.requestAsync(method, reference.toJson()));
      if (isCurrent()) {
        const [size, hasMore] = sizeOf(read);
        held.set(read);
        this.count(tab, `${size}${hasMore ? Resources.moreMark : ""}`);
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
    if (pending === null || pending.key !== JSON.stringify(reference.toJson()))
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
      const outcome: { readonly note: string | null; readonly failure: string | null } = await this.pullOutcomeAsync(pull, url);
      if (generation === this.generation) {
        this.pullNote.set(outcome.note);
        this.pullFailure.set(outcome.failure);
      }
    }
    finally {
      done();
    }
  }

  private async pullOutcomeAsync(pull: PullAfter, url: string): Promise<{ readonly note: string | null; readonly failure: string | null }> {
    if (GitFolder.folder() !== pull.folder)
      return { note: null, failure: Resources.formatPullFolderChanged(pull.branch) };
    let method: string = GitNames.statusMethod;
    try {
      const status: GitStatus = GitStatus.fromJson(await this.context.requestAsync(method, new GitFolderParams(pull.folder).toJson()));
      if (!PullRequestClone.isPullTarget(status, url, pull.branch))
        return { note: null, failure: Resources.formatPullMoved(pull.branch) };
      method = GitNames.pullMethod;
      await this.context.requestAsync(method, new GitPullParams(pull.folder, status.fingerprint).toJson());
      return { note: Resources.formatPulled(pull.branch), failure: null };
    }
    catch (error) {
      if (!(error instanceof WindowException))
        throw error;
      this.context.log(Resources.formatRequestFailed(method, String(error)));
      return { note: null, failure: error instanceof RuntimeRequestException ? error.message : Resources.formatPullUnanswered(pull.branch) };
    }
  }
}
