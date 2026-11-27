/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import {
  Component, computed, DestroyRef, effect, ErrorHandler, inject, Injector, input, type InputSignal, signal, type Signal, untracked, viewChild, type WritableSignal
} from "@angular/core";
import "@noldova/context.core";
import { type IWindowPartContext, LinkPlace, TimeFormatService, WindowPartTokens } from "@noldova/desktop.window";
import {
  DiffScope, DiffScopeKind, type GitCommitDetail, type GitCommitSignature, type GitGraphCommit, type GitRemote, PredictionAction, RefKind, SignatureState
} from "@noldova/git.protocol";
import { FormsModule } from "@angular/forms";
import {
  ButtonComponent, ButtonVariant, FileBadgeComponent, IconButtonComponent, type ILinkReferenceSource, type LinkOpenEvent, MenuComponent, MenuItemComponent,
  MenuTriggerDirective, TextFieldComponent, TooltipDirective
} from "@noldova/ui.components.angular";
import { MarkdownViewComponent } from "@noldova/ui.components.angular/markdown";

import type { IGitPullRequests } from "../../interfaces/i-git-pull-requests.ts";
import type { GitBranchPullRequest } from "../../models/git-branch-pull-request.ts";
import type { GitCommitComments } from "../../models/git-commit-comments.ts";
import { GitCommitPullRequest } from "../../models/git-commit-pull-request.ts";
import { GitBranchView } from "../../models/git-branch-view.ts";
import { GitCommentsLink } from "../../models/git-comments-link.ts";
import { GitLabeledPrediction } from "../../models/git-labeled-prediction.ts";
import { GitPredictionAsk } from "../../models/git-prediction-ask.ts";
import { GitPredictedLine } from "../../models/git-predicted-line.ts";
import { GitPullRequestRead } from "../../models/git-pull-request-read.ts";
import { GitRefChip } from "../../models/git-ref-chip.ts";
import { CommitLabels } from "../../services/commit-labels.ts";
import { GitLinkReferences } from "../../services/git-link-references.ts";
import { GitPullRequests } from "../../services/git-pull-requests.ts";
import { GitRuntimeClient } from "../../services/git-runtime-client.ts";
import { GitViewOptions } from "../../services/git-view-options.ts";
import { GitViewStateService } from "../../services/git-view-state.service.ts";
import { GitRebaseTarget, GitRebasing } from "../../services/git-rebasing.ts";
import { GitViewing } from "../../services/git-viewing.ts";
import { GitAvatars } from "../../services/git-avatars.ts";
import { Resources } from "../../../resources.ts";
import { GitDiffFilesComponent } from "../git-diff-files/git-diff-files.component.ts";
import { GitReferenceTextComponent } from "../git-reference-text/git-reference-text.component.ts";

@Component({
  selector: "nol-git-commit-detail",
  imports: [ButtonComponent, FileBadgeComponent, FormsModule, GitDiffFilesComponent, GitReferenceTextComponent, IconButtonComponent, MarkdownViewComponent,
    MenuComponent, MenuItemComponent, MenuTriggerDirective, TextFieldComponent, TooltipDirective],
  templateUrl: "./git-commit-detail.component.html",
  styleUrl: "./git-commit-detail.component.css"
})
export class GitCommitDetailComponent {
  private readonly context: IWindowPartContext = inject(WindowPartTokens.context);
  private readonly client: GitRuntimeClient = new GitRuntimeClient(this.context);
  private readonly errors: ErrorHandler = inject(ErrorHandler);
  private readonly injector: Injector = inject(Injector);
  private readonly dates: TimeFormatService = inject(TimeFormatService);
  protected readonly state: GitViewStateService = inject(GitViewStateService);

  protected readonly resources: typeof Resources = Resources;
  protected readonly showsAiFeatures: Signal<boolean> = GitViewOptions.showsAiFeatures;
  protected readonly secondary: ButtonVariant = ButtonVariant.Secondary;
  protected readonly branchName: WritableSignal<string | null> = signal<string | null>(null);
  protected readonly tagging: WritableSignal<boolean> = signal(false);
  protected readonly more: WritableSignal<GitCommitDetail | null> = signal<GitCommitDetail | null>(null);
  protected readonly signature: WritableSignal<GitCommitSignature | null> = signal<GitCommitSignature | null>(null);
  private readonly remote: Signal<GitRemote | null> = computed(() => this.state.status()?.remote ?? null, {
    equal: (a, b) => GitCommitDetailComponent.remoteKeyOf(a) === GitCommitDetailComponent.remoteKeyOf(b)
  });
  private readonly pullRequestRead: Signal<GitPullRequestRead | null> = computed(() => {
    const remote: GitRemote | null = this.remote();
    const host: IGitPullRequests | null = Object.isNull(remote) ? null : GitPullRequests.of(remote);
    const commitFor: IGitPullRequests["commitFor"] = host?.commitFor;
    if (Object.isNull(remote) || Object.isNull(host) || Object.isUndefined(commitFor))
      return null;
    const folder: string = this.folder();
    const id: string = this.commit().commit.id;
    const answer: Signal<GitBranchPullRequest | null> | null = this.attempt(() => commitFor.call(host, folder, remote, id), null);
    return Object.isNull(answer) ? null : new GitPullRequestRead(host, answer);
  });
  protected readonly pullRequest: Signal<GitCommitPullRequest | null> = computed(() => {
    const read: GitPullRequestRead | null = this.pullRequestRead();
    return Object.isNull(read) ? null : GitCommitPullRequest.of(read.host, read.answer());
  });
  private readonly commentsRead: Signal<Signal<GitCommitComments | null> | null> = computed(() => {
    const remote: GitRemote | null = this.remote();
    const host: IGitPullRequests | null = Object.isNull(remote) ? null : GitPullRequests.of(remote);
    const commentsFor: IGitPullRequests["commentsFor"] = host?.commentsFor;
    if (Object.isNull(remote) || Object.isNull(host) || Object.isUndefined(commentsFor))
      return null;
    const folder: string = this.folder();
    const id: string = this.commit().commit.id;
    return this.attempt(() => commentsFor.call(host, folder, remote, id), null);
  });
  protected readonly comments: Signal<GitCommentsLink | null> = computed(() => {
    const answer: GitCommitComments | null = this.commentsRead()?.() ?? null;
    if (Object.isNull(answer) || answer.count === 0 || Object.isNull(answer.url))
      return null;
    return new GitCommentsLink(Resources.formatCommitComments(answer.count, answer.isCapped), answer.url);
  });
  private predicting = 0;
  protected readonly writable: Signal<boolean> = computed(() => !this.state.busy() && this.state.folder() === this.folder());
  protected readonly mergeable: Signal<boolean> = computed(() => this.commit().refs.some(t => t.kind === RefKind.Branch || t.kind === RefKind.RemoteBranch));
  protected readonly predictions: WritableSignal<readonly GitLabeledPrediction[]> = signal<readonly GitLabeledPrediction[]>([]);
  protected readonly predicted: Signal<readonly GitPredictedLine[]> = computed(() =>
    this.predictions().flatMap(({ label, prediction }) => {
      const text: string | null = Resources.formatPrediction(label, prediction);
      return Object.isNull(text) ? [] : [new GitPredictedLine(text, prediction.paths.slice(0, Resources.predictedPathsShown),
        Math.max(prediction.paths.length - Resources.predictedPathsShown, 0))];
    }));
  protected readonly files: Signal<GitDiffFilesComponent> = viewChild.required(GitDiffFilesComponent);
  protected readonly references: Signal<ILinkReferenceSource | null> = computed(() => GitLinkReferences.of(this.folder()));
  protected readonly chips: Signal<readonly GitRefChip[]> = computed(() => GitRefChip.chipsOf(this.commit().refs));
  protected readonly id: Signal<string> = computed(() => this.commit().commit.id.slice(0, Resources.commitIdLength));
  protected readonly label: Signal<string> = computed(() => Resources.formatCommitLabel(this.commit().commit.id.slice(0, Resources.shortIdLength)));
  protected readonly initials: Signal<string> = computed(() => CommitLabels.initialsOf(this.commit().commit.author));
  protected readonly avatar: Signal<string> = computed(() => CommitLabels.avatarOf(this.commit().email));
  protected readonly image: Signal<string | null> = computed(() => GitAvatars.imageOf(this.folder(), this.commit().email, this.commit().commit.id));
  protected readonly authored: Signal<string> = computed(() =>
    Resources.formatAuthored(this.dates.shortDateTime(this.commit().commit.authoredAt)));
  protected readonly committed: Signal<string | null> = computed(() => {
    const more: GitCommitDetail | null = this.more();
    if (Object.isNull(more) || more.committer === this.commit().commit.author)
      return null;
    return Resources.formatCommitted(more.committer, this.dates.shortDateTime(more.committedAt));
  });
  protected readonly scope: Signal<DiffScope> = computed(() => {
    const id: string = this.commit().commit.id;
    const parent: string = this.commit().commit.parents[0] ?? (id.length > Resources.emptyTreeSha1.length ? Resources.emptyTreeSha256 : Resources.emptyTreeSha1);
    return new DiffScope(DiffScopeKind.Range, parent, id);
  });

  public readonly folder: InputSignal<string> = input.required<string>();
  public readonly commit: InputSignal<GitGraphCommit> = input.required<GitGraphCommit>();

  public constructor() {
    effect(() => {
      const folder: string = this.folder();
      const id: string = this.commit().commit.id;
      untracked(() => {
        this.branchName.set(null);
        void this.readMoreAsync(folder, id);
        void this.readSignatureAsync(folder, id);
        void this.predictAsync(folder, id);
      });
    });
    inject(DestroyRef).onDestroy(this.client.onChanged(folder => {
      if (folder === this.folder())
        void this.predictAsync(folder, this.commit().commit.id);
    }));
  }

  protected signatureLineOf(signature: GitCommitSignature): string {
    return Resources.formatSignature(signature.state, signature.signer);
  }

  protected showParent(id: string): void {
    GitViewing.branch.set(new GitBranchView(this.folder(), "", false, id));
  }

  protected openLink(opened: LinkOpenEvent): void {
    if (!GitLinkReferences.opens(this.folder(), opened.url, this.injector))
      void this.context.openLinkAsync(opened.url, { gesture: opened.gesture }).catch((error: unknown) => this.errors.handleError(error));
  }

  protected async mergeAsync(): Promise<void> {
    await this.state.mergeAsync(this.commit().commit.id);
  }

  protected async pickAsync(revert: boolean): Promise<void> {
    const id: string = this.commit().commit.id;
    await (revert ? this.state.revertAsync(id) : this.state.cherryPickAsync(id));
  }

  protected startRebase(): void {
    const commit = this.commit();
    const branch = commit.refs.find(t => t.kind === RefKind.Branch) ?? commit.refs.find(t => t.kind === RefKind.RemoteBranch);
    GitRebasing.open(this.folder(), new GitRebaseTarget(commit.commit.id, branch?.name ?? commit.commit.id.slice(0, Resources.shortIdLength)));
    this.context.openDocument(Resources.rebaseDocumentName, this.folder(), Resources.formatRebaseDocumentTitle(this.folder()));
  }

  protected startBranch(tagging: boolean): void {
    this.state.failure.set(null);
    this.tagging.set(tagging);
    this.branchName.set("");
  }

  protected cancelBranch(): void {
    this.branchName.set(null);
    this.state.failure.set(null);
  }

  protected async createBranchAsync(name: string): Promise<void> {
    const id: string = this.commit().commit.id;
    if (await (this.tagging() ? this.state.createTagAsync(name.trim(), id) : this.state.createBranchAtAsync(name.trim(), id)))
      this.branchName.set(null);
  }

  protected openPullRequest(card: GitCommitPullRequest): void {
    if (this.attempt(() => card.host.open?.(this.folder(), card.row) === true, false))
      return;
    void this.context.openLinkAsync(card.row.url, { place: LinkPlace.System }).catch((error: unknown) => this.errors.handleError(error));
  }

  protected openComments(url: string): void {
    void this.context.openLinkAsync(url, { place: LinkPlace.System }).catch((error: unknown) => this.errors.handleError(error));
  }

  protected copyId(): void {
    navigator.clipboard.writeText(this.commit().commit.id).catch((error: unknown) => this.errors.handleError(error));
  }

  private async predictAsync(folder: string, id: string): Promise<void> {
    const read: number = ++this.predicting;
    this.predictions.set([]);
    const actions: readonly GitPredictionAsk[] = [
      ...untracked(this.mergeable) ? [new GitPredictionAsk(Resources.mergeLabel, PredictionAction.Merge)] : [],
      new GitPredictionAsk(Resources.cherryPickLabel, PredictionAction.CherryPick),
      new GitPredictionAsk(Resources.revertLabel, PredictionAction.Revert)
    ];
    try {
      const answers: readonly GitLabeledPrediction[] = await Promise.all(actions.map(async ({ label, action }) =>
        new GitLabeledPrediction(label, await this.client.predictAsync(folder, id, action))));
      if (read === this.predicting)
        this.predictions.set(answers);
    }
    catch (error) {
      if (!GitRuntimeClient.isFailure(error))
        this.errors.handleError(error);
    }
  }

  private async readMoreAsync(folder: string, id: string): Promise<void> {
    this.more.set(null);
    try {
      const more: GitCommitDetail = await this.client.commitDetailAsync(folder, id);
      if (more.id === this.commit().commit.id)
        this.more.set(more);
    }
    catch (error) {
      if (!GitRuntimeClient.isFailure(error))
        this.errors.handleError(error);
    }
  }

  private async readSignatureAsync(folder: string, id: string): Promise<void> {
    this.signature.set(null);
    try {
      const signature: GitCommitSignature = await this.client.commitSignatureAsync(folder, id);
      if (signature.id === this.commit().commit.id && signature.state !== SignatureState.None)
        this.signature.set(signature);
    }
    catch (error) {
      if (!GitRuntimeClient.isFailure(error))
        this.errors.handleError(error);
    }
  }

  private static remoteKeyOf(remote: GitRemote | null): string {
    return Object.isNull(remote) ? "" : JSON.stringify([remote.name, remote.host, remote.path, remote.transport]);
  }

  private attempt<T>(run: () => T, fallback: T): T {
    try {
      return run();
    }
    catch (error) {
      this.errors.handleError(error);
      return fallback;
    }
  }
}
