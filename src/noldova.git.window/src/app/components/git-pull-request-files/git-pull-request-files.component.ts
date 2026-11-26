/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import {
  afterRenderEffect, Component, computed, DestroyRef, effect, inject, input, type InputSignal, output, type OutputEmitterRef, PendingTasks, type Signal, signal, untracked, viewChild, type WritableSignal
} from "@angular/core";
import "@noldova/context.core";
import { type IWindowPartContext, WindowException, WindowPartTokens } from "@noldova/desktop.window";
import { type HostPullRequestFile, HostPullRequestFiles, type HostReference } from "@noldova/git.hosting.protocol";
import { DiffScope, DiffScopeKind, DiffTotals, GitCommitDetailParams, GitDiffParams, GitFetchParams, GitFolderParams, GitNames, GitStatus }
  from "@noldova/git.protocol";
import { ButtonComponent, ButtonVariant, FileBadgeComponent, SpinnerComponent } from "@noldova/ui.components.angular";

import { GitFileLayout } from "../../enums/git-file-layout.ts";
import type { IGitPullRequestHost } from "../../interfaces/i-git-pull-request-host.ts";
import type { GitFileLine } from "../../models/git-file-line.ts";
import type { GitPathEntry } from "../../models/git-path-entry.ts";
import { GitFolder } from "../../services/git-folder.ts";
import { GitPathLayout } from "../../services/git-path-layout.ts";
import { GitRuntimeClient } from "../../services/git-runtime-client.ts";
import { Resources } from "../../../resources.ts";
import { GitDiffFilesComponent } from "../git-diff-files/git-diff-files.component.ts";
import { GitFileLayoutButtonComponent } from "../git-file-layout-button/git-file-layout-button.component.ts";

/**
 * The pull request page's Files tab: the files its latest push changes. When the open repository is the pull request's and has that push's commits, it shows
 * the changes from local Git; otherwise it lists the paths the host names, never their contents, with a Fetch for a repository that lacks the commits. Both
 * follow the layout its button chooses: a tree, folders or a list.
 * It reads again when another repository is opened, and when the pull request's repository changes, as a fetch or a switch there may bring the push's
 * commits, it looks for them again without asking the host.
 */
@Component({
  selector: "nol-git-pull-request-files",
  templateUrl: "./git-pull-request-files.component.html",
  styleUrl: "./git-pull-request-files.component.css",
  imports: [ButtonComponent, FileBadgeComponent, GitDiffFilesComponent, GitFileLayoutButtonComponent, SpinnerComponent]
})
export class GitPullRequestFilesComponent {
  private readonly context: IWindowPartContext = inject(WindowPartTokens.context);
  private readonly tasks: PendingTasks = inject(PendingTasks);
  private readonly client: GitRuntimeClient = new GitRuntimeClient(this.context);
  private readonly attempt: WritableSignal<number> = signal<number>(0);
  private readonly diffFiles: Signal<GitDiffFilesComponent | undefined> = viewChild(GitDiffFilesComponent);
  /** Whether the tab has yet to read, so it shows the handed-over answer instead. */
  private isFirstRead: boolean = true;
  /** The line the tab last revealed or reported unrevealed, so it handles each once. */
  private revealed: GitFileLine | null = null;

  protected readonly resources: typeof Resources = Resources;
  protected readonly secondary: ButtonVariant = ButtonVariant.Secondary;
  protected readonly list: WritableSignal<HostPullRequestFiles | null> = signal<HostPullRequestFiles | null>(null);
  /** The open repository's folder when it is the pull request's. */
  protected readonly folder: WritableSignal<string | null> = signal<string | null>(null);
  /** The latest push's changes from its common commit, once the open repository has both commits. */
  protected readonly scope: WritableSignal<DiffScope | null> = signal<DiffScope | null>(null);
  protected readonly failure: WritableSignal<string | null> = signal<string | null>(null);
  protected readonly isReading: WritableSignal<boolean> = signal<boolean>(true);
  protected readonly isFetching: WritableSignal<boolean> = signal<boolean>(false);
  protected readonly fetchFailure: WritableSignal<string | null> = signal<string | null>(null);
  /** How the tab lays its files out, the host's list and local Git's alike: a tree, folders or a list. */
  protected readonly layout: WritableSignal<GitFileLayout> = signal<GitFileLayout>(GitFileLayout.Folders);
  /** The host's list's folders the person closed, by path. */
  protected readonly closed: WritableSignal<ReadonlySet<string>> = signal<ReadonlySet<string>>(new Set());
  /** The host's list's files, which the rows lay out; none while no list is read. */
  private readonly files: WritableSignal<readonly HostPullRequestFile[]> = signal<readonly HostPullRequestFile[]>([]);
  protected readonly rows: Signal<readonly GitPathEntry<HostPullRequestFile>[]> = computed(() =>
    GitPathLayout.layout(this.files(), t => t.path, this.layout(), this.closed()));

  /** The host that reads the tab's list and finds the pull request's repository on this computer. */
  public readonly host: InputSignal<IGitPullRequestHost> = input.required<IGitPullRequestHost>();

  /** The pull request whose files it lists. */
  public readonly reference: InputSignal<HostReference> = input.required<HostReference>();

  /** The pull request's page on its host, which names its repository, so the tab can tell whether the open repository is that one. */
  public readonly url: InputSignal<string> = input.required<string>();

  /** The files as the page already read them, which the first read shows instead of reading them again; `null` to read them. Try again reads them anew. */
  public readonly answer: InputSignal<HostPullRequestFiles | null> = input<HostPullRequestFiles | null>(null);

  /** A line to show in its file's diff once the tab has read, such as a comment thread's; `null` for none. */
  public readonly reveal: InputSignal<GitFileLine | null> = input<GitFileLine | null>(null);

  /** The tab's count once read, such as `12` or `5000+`: the files local Git counts when the tab shows its changes, else the host's list's. */
  public readonly counted: OutputEmitterRef<string> = output<string>();

  /** A line given in `reveal` that the tab can't show, as the changes from local Git aren't here or don't hold its file, so the page can show it elsewhere. */
  public readonly unrevealed: OutputEmitterRef<GitFileLine> = output<GitFileLine>();

  public constructor() {
    effect(onCleanup => {
      this.attempt();
      GitFolder.folder();
      const reference: HostReference = this.reference();
      let isCurrent = true;
      onCleanup(() => {
        isCurrent = false;
      });
      untracked(() => {
        const given: HostPullRequestFiles | null = this.isFirstRead ? this.answer() : null;
        this.isFirstRead = false;
        this.list.set(null);
        this.files.set([]);
        this.folder.set(null);
        this.scope.set(null);
        this.failure.set(null);
        this.isReading.set(true);
        void this.readAsync(reference, given, () => isCurrent);
      });
    });
    inject(DestroyRef).onDestroy(this.client.onChanged(folder => {
      const list: HostPullRequestFiles | null = this.list();
      if (!Object.isNull(list) && folder === this.folder() && Object.isNull(this.scope()))
        void this.placeAsync(folder, list);
    }));
    afterRenderEffect(() => {
      const line: GitFileLine | null = this.reveal();
      if (Object.isNull(line) || line === this.revealed || this.isReading())
        return;
      const files: GitDiffFilesComponent | undefined = this.diffFiles();
      if (!Object.isUndefined(files) && !files.isRead())
        return;
      this.revealed = line;
      if (!Object.isUndefined(files) && files.holds(line.path))
        untracked(() => files.reveal(line.path, line.line));
      else
        untracked(() => this.unrevealed.emit(line));
    });
  }

  protected retry(): void {
    this.attempt.update(t => t + 1);
  }

  /** A row's start inset in rem past the top level, as the commit's files step in; `null` at the top, which keeps its own. */
  protected insetOf(depth: number): number | null {
    return depth === 0 ? null : Resources.rowStartRem + depth * Resources.commitFileStepRem;
  }

  /** A path's file name, which picks its badge. */
  protected nameOf(path: string): string {
    return path.slice(path.lastIndexOf(Resources.slash) + 1);
  }

  protected toggle(folder: string): void {
    const closed: Set<string> = new Set(this.closed());
    if (!closed.delete(folder))
      closed.add(folder);
    this.closed.set(closed);
  }

  protected letterOf(file: HostPullRequestFile): string {
    return Resources.pullRequestFileLetters[file.kind];
  }

  protected fetch(folder: string): void {
    void this.fetchAsync(folder);
  }

  /** Fetches with the existing fetch, as the History toolbar's Fetch does, then reads the tab again so it can show the changes. */
  private async fetchAsync(folder: string): Promise<void> {
    const done = this.tasks.add();
    this.isFetching.set(true);
    this.fetchFailure.set(null);
    try {
      const status: GitStatus = GitStatus.fromJson(await this.context.requestAsync(GitNames.statusMethod, new GitFolderParams(folder).toJson()));
      await this.context.requestAsync(GitNames.fetchMethod, new GitFetchParams(folder, status.fingerprint).toJson());
      this.retry();
    }
    catch (error) {
      if (!(error instanceof WindowException))
        throw error;
      this.context.log(Resources.formatHostRequestFailed(this.host().name, GitNames.fetchMethod, String(error)));
      this.fetchFailure.set(Resources.pullRequestFilesFetchFailed);
    }
    finally {
      this.isFetching.set(false);
      done();
    }
  }

  private async readAsync(reference: HostReference, given: HostPullRequestFiles | null, isCurrent: () => boolean): Promise<void> {
    const done = this.tasks.add();
    try {
      const [list, folder] = await Promise.all([given ?? this.readListAsync(reference), this.host().localFolderAsync(this.url())]);
      const scope: DiffScope | null = Object.isNull(folder) || Object.isNull(list.sourceCommit) || Object.isNull(list.commonCommit) ? null
        : await this.scopeAsync(folder, list.commonCommit, list.sourceCommit);
      const totals: DiffTotals | null = Object.isNull(folder) || Object.isNull(scope) ? null : await this.totalsAsync(folder, scope);
      if (!isCurrent())
        return;
      this.list.set(list);
      this.files.set(list.files);
      this.folder.set(folder);
      this.scope.set(scope);
      this.counted.emit(Object.isNull(totals) ? `${list.files.length}${list.hasMore ? Resources.pullRequestMoreMark : ""}` : String(totals.files));
    }
    catch (error) {
      if (!(error instanceof WindowException))
        throw error;
      this.context.log(Resources.formatHostRequestFailed(this.host().name, this.host().readChangesMethod, String(error)));
      if (isCurrent())
        this.failure.set(Resources.formatPullRequestFilesUnanswered(this.host().name));
    }
    finally {
      if (isCurrent())
        this.isReading.set(false);
      done();
    }
  }

  private async readListAsync(reference: HostReference): Promise<HostPullRequestFiles> {
    return HostPullRequestFiles.fromJson(await this.context.requestAsync(this.host().readChangesMethod, reference.toJson()));
  }

  /** The range from the common commit to the head commit when the repository has both; `null` when it lacks either, which a fetch brings. */
  /** The files local Git counts in the changes the tab shows from it, as its header counts them; `null` when Git can't count them, which it logs. */
  private async totalsAsync(folder: string, scope: DiffScope): Promise<DiffTotals | null> {
    try {
      return DiffTotals.fromJson(await this.context.requestAsync(GitNames.diffTotalsMethod, new GitDiffParams(folder, scope).toJson()));
    }
    catch (error) {
      if (!(error instanceof WindowException))
        throw error;
      this.context.log(Resources.formatHostRequestFailed(this.host().name, GitNames.diffTotalsMethod, String(error)));
      return null;
    }
  }

  /** Looks for the push's changes in local Git again once the pull request's repository changes, as a fetch or a switch there may bring its commits. */
  private async placeAsync(folder: string, list: HostPullRequestFiles): Promise<void> {
    if (Object.isNull(list.sourceCommit) || Object.isNull(list.commonCommit))
      return;
    const done = this.tasks.add();
    try {
      const scope: DiffScope | null = await this.scopeAsync(folder, list.commonCommit, list.sourceCommit);
      if (Object.isNull(scope) || this.list() !== list)
        return;
      const totals: DiffTotals | null = await this.totalsAsync(folder, scope);
      if (this.list() !== list)
        return;
      this.scope.set(scope);
      if (!Object.isNull(totals))
        this.counted.emit(String(totals.files));
    }
    finally {
      done();
    }
  }

  private async scopeAsync(folder: string, common: string, source: string): Promise<DiffScope | null> {
    try {
      await Promise.all([common, source].map(t => this.context.requestAsync(GitNames.commitDetailMethod, new GitCommitDetailParams(folder, t).toJson())));
      return new DiffScope(DiffScopeKind.Range, common, source);
    }
    catch (error) {
      if (!(error instanceof WindowException))
        throw error;
      return null;
    }
  }
}
