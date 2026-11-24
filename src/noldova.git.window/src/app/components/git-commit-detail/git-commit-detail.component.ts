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
import { type IWindowPartContext, LinkPlace, WindowPartTokens } from "@noldova/desktop.window";
import {
  DiffScope, DiffScopeKind, type GitCommitDetail, type GitCommitSignature, type GitGraphCommit, type GitPrediction, type GitRemote, PredictionAction, RefKind, SignatureState
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
import { GitRefChip } from "../../models/git-ref-chip.ts";
import { GitReferencePart } from "../../models/git-reference-part.ts";
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

/** A commit the history selected: its id, subject and message, author and committer, parents, actions and the files it changes, against its first parent. */
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
  protected readonly state: GitViewStateService = inject(GitViewStateService);

  protected readonly resources: typeof Resources = Resources;
  /** Whether the app turned the module's AI features on, which shows its button. */
  protected readonly showsAiFeatures: Signal<boolean> = GitViewOptions.showsAiFeatures;
  protected readonly around: typeof GitReferencePart.around = GitReferencePart.around;
  protected readonly secondary: ButtonVariant = ButtonVariant.Secondary;
  /** The new branch's name while "Branch here" asks for one, or null. */
  protected readonly branchName: WritableSignal<string | null> = signal<string | null>(null);
  /** Whether the name field makes a tag rather than a branch. */
  protected readonly tagging: WritableSignal<boolean> = signal(false);
  /** The message after the subject and the committer, read apart from the files; null until read, or when Git couldn't read them. */
  protected readonly more: WritableSignal<GitCommitDetail | null> = signal<GitCommitDetail | null>(null);
  /** Whether the commit's signature checks out and who signed it; null until read, for an unsigned commit, or when Git couldn't check it. */
  protected readonly signature: WritableSignal<GitCommitSignature | null> = signal<GitCommitSignature | null>(null);
  /**
   * The current branch's remote, kept while each status read gives an equal one, so the host is asked again only for another remote or commit.
   * The view shows a commit only from the folder it shows, whose status this is.
   */
  private readonly remote: Signal<GitRemote | null> = computed(() => this.state.status()?.remote ?? null, {
    equal: (a, b) => GitCommitDetailComponent.remoteKeyOf(a) === GitCommitDetailComponent.remoteKeyOf(b)
  });
  /** The host that claims the remote, with its answer for the commit; null when no host claims it or the host reads no commit's pull request. */
  private readonly pullRequestRead: Signal<readonly [IGitPullRequests, Signal<GitBranchPullRequest | null>] | null> = computed(() => {
    const remote: GitRemote | null = this.remote();
    const host: IGitPullRequests | null = remote === null ? null : GitPullRequests.of(remote);
    const commitFor: IGitPullRequests["commitFor"] = host?.commitFor;
    if (remote === null || host === null || commitFor === undefined)
      return null;
    const folder: string = this.folder();
    const id: string = this.commit().commit.id;
    const answer: Signal<GitBranchPullRequest | null> | null = this.attempt(() => commitFor.call(host, folder, remote, id), null);
    return answer === null ? null : [host, answer];
  });
  /** The card of the pull request that brought the commit in, or null while there is none to show. */
  protected readonly pullRequest: Signal<GitCommitPullRequest | null> = computed(() => {
    const read: readonly [IGitPullRequests, Signal<GitBranchPullRequest | null>] | null = this.pullRequestRead();
    return read === null ? null : GitCommitPullRequest.of(read[0], read[1]());
  });
  /** The host's answer for the commit's review comments, asked once for each remote and commit; null when no host claims the remote or it reads none. */
  private readonly commentsRead: Signal<Signal<GitCommitComments | null> | null> = computed(() => {
    const remote: GitRemote | null = this.remote();
    const host: IGitPullRequests | null = remote === null ? null : GitPullRequests.of(remote);
    const commentsFor: IGitPullRequests["commentsFor"] = host?.commentsFor;
    if (remote === null || host === null || commentsFor === undefined)
      return null;
    const folder: string = this.folder();
    const id: string = this.commit().commit.id;
    return this.attempt(() => commentsFor.call(host, folder, remote, id), null);
  });
  /** The row that opens the commit's review comments: its text and the page it opens; null with none to show. */
  protected readonly comments: Signal<readonly [string, string] | null> = computed(() => {
    const answer: GitCommitComments | null = this.commentsRead()?.() ?? null;
    if (answer === null || answer.count === 0 || answer.url === null)
      return null;
    return [Resources.formatCommitComments(answer.count, answer.isCapped), answer.url];
  });
  /** Whether the commit is a branch's tip, local or remote, which the current branch can merge. */
  protected readonly mergeable: Signal<boolean> = computed(() => this.commit().refs.some(t => t.kind === RefKind.Branch || t.kind === RefKind.RemoteBranch));
  /** What a merge of a branch's tip, a cherry-pick and a revert of the commit would do on the current branch, by action's label; none until read, and one Git can't tell leaves its line out. */
  protected readonly predictions: WritableSignal<readonly (readonly [string, GitPrediction])[]> = signal([]);
  /** Each line on what an action would do, with the first files a predicted conflict names and how many more it names. */
  protected readonly predicted: Signal<readonly { readonly text: string; readonly paths: readonly string[]; readonly more: number }[]> = computed(() =>
    this.predictions().flatMap(([label, prediction]) => {
      const text: string | null = Resources.formatPrediction(label, prediction);
      return text === null ? [] : [{
        text, paths: prediction.paths.slice(0, Resources.predictedPathsShown), more: Math.max(prediction.paths.length - Resources.predictedPathsShown, 0)
      }];
    }));
  /** The commit's files, whose diff a predicted conflict's file badge opens. */
  protected readonly files: Signal<GitDiffFilesComponent> = viewChild.required(GitDiffFilesComponent);
  /** The host modules' link source for the repository, which draws links to their items in the message as chips, or null. */
  protected readonly references: Signal<ILinkReferenceSource | null> = computed(() => GitLinkReferences.of(this.folder()));
  protected readonly chips: Signal<readonly GitRefChip[]> = computed(() => GitRefChip.chipsOf(this.commit().refs));
  protected readonly id: Signal<string> = computed(() => this.commit().commit.id.slice(0, Resources.commitIdLength));
  protected readonly label: Signal<string> = computed(() => Resources.formatCommitLabel(this.commit().commit.id.slice(0, Resources.shortIdLength)));
  protected readonly initials: Signal<string> = computed(() => CommitLabels.initialsOf(this.commit().commit.author));
  protected readonly avatar: Signal<string> = computed(() => CommitLabels.avatarOf(this.commit().email));
  /** The author's picture as a data address, or null to show their initials. */
  protected readonly image: Signal<string | null> = computed(() => GitAvatars.imageOf(this.folder(), this.commit().email, this.commit().commit.id));
  protected readonly authored: Signal<string> = computed(() =>
    Resources.formatAuthored(new Date(this.commit().commit.authoredAt).toLocaleString(Resources.dateLocale, Resources.authoredFormat)));
  /** Who committed it and when, when that isn't its author. */
  protected readonly committed: Signal<string | null> = computed(() => {
    const more: GitCommitDetail | null = this.more();
    if (more === null || more.committer === this.commit().commit.author)
      return null;
    return Resources.formatCommitted(more.committer, new Date(more.committedAt).toLocaleString(Resources.dateLocale, Resources.authoredFormat));
  });
  /** The commit's changes against its first parent, or against the empty tree for a root commit. */
  protected readonly scope: Signal<DiffScope> = computed(() => {
    const id: string = this.commit().commit.id;
    const parent: string = this.commit().commit.parents[0] ?? (id.length > Resources.emptyTreeSha1.length ? Resources.emptyTreeSha256 : Resources.emptyTreeSha1);
    return new DiffScope(DiffScopeKind.Range, parent, id);
  });

  /** The repository's folder. */
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

  /** The signature row's words, such as "Signed by Ada, verified against the keys you trust". */
  protected signatureLineOf(signature: GitCommitSignature): string {
    return Resources.formatSignature(signature.state, signature.signer);
  }

  /** Selects a parent in the history, scrolling to it and reading further pages until it shows. */
  protected showParent(id: string): void {
    GitViewing.branch.set(new GitBranchView(this.folder(), "", false, id));
  }

  protected openLink(opened: LinkOpenEvent): void {
    if (!GitLinkReferences.opens(this.folder(), opened.url, this.injector))
      void this.context.openLinkAsync(opened.url, { gesture: opened.gesture });
  }

  /** Merges the commit into the current branch; a conflict shows in the Git panel's changes, and a failure here. */
  protected async mergeAsync(): Promise<void> {
    await this.state.mergeAsync(this.commit().commit.id);
  }

  /** Cherry-picks the commit onto the current branch, or reverts it there; a conflict shows in the Git panel's changes, and a failure here. */
  protected async pickAsync(revert: boolean): Promise<void> {
    const id: string = this.commit().commit.id;
    await (revert ? this.state.revertAsync(id) : this.state.cherryPickAsync(id));
  }

  /** Opens the rebase screen for the current branch onto this commit, named by its first local or remote branch, else its short id. */
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

  /** Makes the branch or tag at this commit; the field stays, with Git's refusal under it, when it can't. */
  protected async createBranchAsync(name: string): Promise<void> {
    const id: string = this.commit().commit.id;
    if (await (this.tagging() ? this.state.createTagAsync(name.trim(), id) : this.state.createBranchAtAsync(name.trim(), id)))
      this.branchName.set(null);
  }

  /** Opens the pull request in its host's own page when the host has one, else its page in the browser. */
  protected openPullRequest(card: GitCommitPullRequest): void {
    if (this.attempt(() => card.host.open?.(this.folder(), card.row) === true, false))
      return;
    void this.context.openLinkAsync(card.row.url, { place: LinkPlace.System }).catch((error: unknown) => this.errors.handleError(error));
  }

  /** Opens the host's page of the commit's review comments in the browser, as a pull request's page opens. */
  protected openComments(url: string): void {
    void this.context.openLinkAsync(url, { place: LinkPlace.System }).catch((error: unknown) => this.errors.handleError(error));
  }

  protected copyId(): void {
    navigator.clipboard.writeText(this.commit().commit.id).catch((error: unknown) => this.errors.handleError(error));
  }

  /** Reads what a merge of a branch's tip, a cherry-pick and a revert would do, keeping only the answers for the commit still shown; a Git failure leaves the predictions out. */
  private async predictAsync(folder: string, id: string): Promise<void> {
    this.predictions.set([]);
    const actions: readonly (readonly [string, PredictionAction])[] = [
      ...untracked(this.mergeable) ? [[Resources.mergeLabel, PredictionAction.Merge] as const] : [],
      [Resources.cherryPickLabel, PredictionAction.CherryPick],
      [Resources.revertLabel, PredictionAction.Revert]
    ];
    try {
      const answers = await Promise.all(actions.map(async ([label, action]) => [label, await this.client.predictAsync(folder, id, action)] as const));
      if (id === this.commit().commit.id)
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

  /** What tells one remote from another: its name, host, path and transport, or nothing without one. */
  private static remoteKeyOf(remote: GitRemote | null): string {
    return remote === null ? "" : JSON.stringify([remote.name, remote.host, remote.path, remote.transport]);
  }

  /** Runs a host's member, reporting what it throws and answering the fallback instead. */
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
