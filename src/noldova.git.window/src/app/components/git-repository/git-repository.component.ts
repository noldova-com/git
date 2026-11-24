/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Component, computed, DestroyRef, effect, ErrorHandler, inject, signal, type Signal, untracked, type WritableSignal } from "@angular/core";
import { type IWindowPartContext, WindowPartTokens } from "@noldova/desktop.window";
import { ContextMenuTriggerDirective, DialogService, MenuComponent, MenuItemComponent, MenuSeparatorComponent, SpinnerComponent, TextFieldComponent } from "@noldova/ui.components.angular";
import { FormsModule } from "@angular/forms";
import type { GitBranches, GitBranchTrack, GitRemote, GitRemoteTracks, GitRepositoryItems, GitStatus, GitWorktrees } from "@noldova/git.protocol";

import type { GitBranchRow } from "../../models/git-branch-row.ts";
import type { GitRepositoryLink } from "../../models/git-repository-link.ts";
import { GitBranchView } from "../../models/git-branch-view.ts";
import { GitAgentsComponent } from "../git-agents/git-agents.component.ts";
import { GitPullRequestsComponent } from "../git-pull-requests/git-pull-requests.component.ts";
import { GitCommitDetails } from "../../services/git-commit-details.ts";
import { GitFolder } from "../../services/git-folder.ts";
import { GitNewBranch } from "../../services/git-new-branch.ts";
import { GitPendingSwitch } from "../../services/git-pending-switch.ts";
import { GitRepositoryLinks } from "../../services/git-repository-links.ts";
import { GitBranchTree } from "../../services/git-branch-tree.ts";
import { GitRuntimeClient } from "../../services/git-runtime-client.ts";
import { GitViewStateService } from "../../services/git-view-state.service.ts";
import { GitViewing } from "../../services/git-viewing.ts";
import { Resources } from "../../../resources.ts";

/** The repository's side panel: its name and folder, its changes and history, its host modules' rows, and its branches, agents, pull requests, remotes, tags, stashes, worktrees and submodules. */
@Component({
  selector: "nol-git-repository",
  imports: [ContextMenuTriggerDirective, FormsModule, GitAgentsComponent, GitPullRequestsComponent, MenuComponent, MenuItemComponent, MenuSeparatorComponent, SpinnerComponent,
    TextFieldComponent],
  templateUrl: "./git-repository.component.html",
  styleUrl: "./git-repository.component.css"
})
export class GitRepositoryComponent {
  private readonly context: IWindowPartContext = inject(WindowPartTokens.context);
  private readonly client: GitRuntimeClient = new GitRuntimeClient(this.context);
  private readonly errors: ErrorHandler = inject(ErrorHandler);
  private readonly dialogs: DialogService = inject(DialogService);
  protected readonly status: WritableSignal<GitStatus | null> = signal<GitStatus | null>(null);
  private readonly branches: WritableSignal<GitBranches | null> = signal<GitBranches | null>(null);
  /** How far each local branch is from its upstream, by branch, for the branches that are ahead or behind. */
  private readonly tracks: Signal<ReadonlyMap<string, GitBranchTrack>> = computed(() => new Map(this.branches()?.tracks.map(t => [t.branch, t])));
  private readonly worktrees: WritableSignal<GitWorktrees | null> = signal<GitWorktrees | null>(null);
  protected readonly items: WritableSignal<GitRepositoryItems | null> = signal<GitRepositoryItems | null>(null);
  private readonly opened: WritableSignal<ReadonlySet<string>> = signal<ReadonlySet<string>>(new Set([Resources.branchesLabel]));
  private reading = 0;
  /** The local branch whose name the panel's field edits, or null. */
  protected readonly renaming: WritableSignal<string | null> = signal<string | null>(null);
  protected readonly newName: WritableSignal<string> = signal("");

  protected readonly resources: typeof Resources = Resources;
  protected readonly folder: Signal<string | null> = GitFolder.folder;
  protected readonly failure: WritableSignal<string | null> = signal<string | null>(null);
  protected readonly busy: WritableSignal<boolean> = signal(false);
  /** Whether the first read of the branches is still under way, with no failure to show instead. */
  protected readonly isReading: Signal<boolean> = computed(() => this.branches() === null && this.failure() === null);
  /** The reading row's start inset in rem: a top-level branch row's, so the spinner sits in its icon's place. */
  protected readonly readingIndent: number = Resources.rowInsetRem + Resources.treeStepRem;
  protected readonly changes: Signal<number> = computed(() => this.status()?.entries.length ?? 0);
  /** The host modules' rows for the repository's remote, under Changes and History; none without a remote. */
  protected readonly links: Signal<readonly GitRepositoryLink[]> = computed(() => {
    const remote: GitRemote | null = this.status()?.remote ?? null;
    return remote === null ? [] : GitRepositoryLinks.of(remote);
  });
  /** Whether the history selected a commit, which the Commit view shows, rather than the changes. */
  protected readonly showsCommit: Signal<boolean> = computed(() => GitViewing.commitOf(this.folder()) !== null);
  protected readonly switching: Signal<string | null> = computed(() => GitPendingSwitch.branchOf(this.folder()));
  protected readonly current: Signal<string | null> = computed(() => this.switching() ?? this.branches()?.current ?? null);
  /** The status a switch is based on, or null while there is none or a switch runs. */
  protected readonly switchable: Signal<GitStatus | null> = computed(() => this.busy() ? null : this.status());
  protected readonly ahead: Signal<number> = computed(() => this.status()?.upstream?.ahead ?? 0);
  protected readonly behind: Signal<number> = computed(() => this.status()?.upstream?.behind ?? 0);
  protected readonly localRows: Signal<readonly GitBranchRow[]> = computed(() =>
    GitBranchTree.localRowsOf(Resources.localTreeKey, this.branches()?.branches ?? [], this.opened()));
  protected readonly remotes: Signal<readonly string[]> = computed(() => this.branches()?.remotes ?? []);
  protected readonly remoteRows: Signal<readonly GitBranchRow[]> = computed(() =>
    GitBranchTree.remoteRowsOf(this.remotes(), this.branches()?.remoteBranches ?? [], this.opened()));
  private readonly remotesOpen: Signal<boolean> = computed(() => this.opened().has(Resources.remotesLabel));
  /** How far each remote branch is ahead of and behind HEAD, by branch, for those that aren't level with it; read only while the remotes show. */
  private readonly remoteTracks: WritableSignal<ReadonlyMap<string, GitBranchTrack>> = signal<ReadonlyMap<string, GitBranchTrack>>(new Map());
  private remoteReading = 0;
  protected readonly worktreeFolders: Signal<readonly string[]> = computed(() => (this.worktrees()?.worktrees ?? []).map(t => t.path));

  public constructor() {
    effect(onCleanup => {
      const folder: string | null = this.folder();
      this.status.set(null);
      this.branches.set(null);
      this.worktrees.set(null);
      this.items.set(null);
      this.failure.set(null);
      if (folder === null)
        return;
      untracked(() => {
        void this.readAsync(folder);
        void this.client.watchAsync(folder).catch((error: unknown) => this.report(error));
      });
      onCleanup(() => void this.client.unwatchAsync(folder).catch((error: unknown) => this.report(error)));
    });
    effect(() => {
      const folder: string | null = this.folder();
      const branches: GitBranches | null = this.branches();
      const reading: number = ++this.remoteReading;
      if (branches === null)
        this.remoteTracks.set(new Map());
      if (folder === null || branches === null || !this.remotesOpen())
        return;
      untracked(() => void this.readRemoteTracksAsync(folder, reading));
    });
    inject(DestroyRef).onDestroy(this.client.onChanged(folder => {
      if (folder === this.folder())
        void this.readAsync(folder);
    }));
  }

  /** A local branch's commits ahead of and behind its upstream: the status's for the current branch, which it reads after every change, and the branch list's for the others. */
  protected countsOf(branch: string, isCurrent: boolean): readonly [number, number] {
    if (isCurrent)
      return [this.ahead(), this.behind()];
    const track: GitBranchTrack | undefined = this.tracks().get(branch);
    return track === undefined ? [0, 0] : [track.ahead, track.behind];
  }

  /** A remote branch's commits ahead of and behind HEAD. */
  protected remoteCountsOf(branch: string): readonly [number, number] {
    const track: GitBranchTrack | undefined = this.remoteTracks().get(branch);
    return track === undefined ? [0, 0] : [track.ahead, track.behind];
  }

  /** A branch tree row's start inset in rem: the row's own, then a step per level. */
  protected indentOf(row: GitBranchRow): number {
    return Resources.rowInsetRem + row.depth * Resources.treeStepRem;
  }

  /** Whether the side panel shows this branch in the history. */
  protected isViewed(branch: string, isRemote: boolean): boolean {
    const view: GitBranchView | null = GitViewing.branchOf(this.folder());
    return view !== null && view.branch === branch && view.isRemote === isRemote;
  }

  /** Shows a branch in the history, at its newest commit, without switching to it. */
  protected view(folder: string, branch: string, isRemote: boolean): void {
    GitViewing.branch.set(new GitBranchView(folder, branch, isRemote));
    this.history(folder);
  }

  protected isOpen(section: string): boolean {
    return this.opened().has(section);
  }

  protected toggle(section: string): void {
    const opened: Set<string> = new Set(this.opened());
    if (!opened.delete(section))
      opened.add(section);
    this.opened.set(opened);
  }

  /** Selects the changes in place of a commit the history selected, which leaves the Commit view without one, and brings the Git view forward. */
  protected showChanges(): void {
    GitViewing.commit.set(null);
    this.context.showView(Resources.viewName);
  }

  /**
   * Opens the history, or brings it forward, at the newest commit of the branch the panel shows there, or of HEAD without one or after the Git
   * panel picked a commit, which the Commit view then shows and brings forward; a repository without commits only opens it.
   */
  protected showHistory(folder: string): void {
    const viewed: GitBranchView | null = GitViewing.branchOf(folder);
    const head: string | null = this.status()?.head ?? null;
    if (viewed !== null && viewed.branch !== "")
      GitViewing.branch.set(new GitBranchView(folder, viewed.branch, viewed.isRemote));
    else if (head !== null)
      GitViewing.branch.set(new GitBranchView(folder, "", false, head));
    GitCommitDetails.of(this.context).bringForward();
    this.history(folder);
  }

  protected history(folder: string): void {
    this.context.openDocument(Resources.historyDocumentName, folder, Resources.formatHistoryTitle(folder));
  }

  protected switchTo(folder: string, name: string): void {
    const status: GitStatus | null = this.switchable();
    if (status === null || name === this.current())
      return;
    void this.switchAsync(folder, name, status.fingerprint);
  }

  private async switchAsync(folder: string, name: string, basedOn: string): Promise<void> {
    await GitPendingSwitch.runAsync(folder, name, async () => { await this.writeAsync(folder, () => this.client.switchBranchAsync(folder, name, basedOn)); });
  }

  protected startRename(branch: string): void {
    this.failure.set(null);
    this.renaming.set(branch);
    this.newName.set(branch);
  }

  protected cancelRename(): void {
    this.renaming.set(null);
  }

  /** Renames the branch; the field stays, with Git's refusal under the panel, when it can't. */
  protected async renameAsync(folder: string, branch: string, newName: string): Promise<void> {
    const status: GitStatus | null = this.switchable();
    const name: string = newName.trim();
    if (status === null || name.length === 0)
      return;
    if (name === branch) {
      this.renaming.set(null);
      return;
    }
    if (await this.writeAsync(folder, () => this.client.renameBranchAsync(folder, branch, name, status.fingerprint)))
      this.renaming.set(null);
  }

  /** Asks for the name and creates the branch at the current commit on the status read before the ask, switching to it. */
  protected async newBranchAsync(folder: string, status: GitStatus): Promise<void> {
    const name: string | null = await GitNewBranch.askAsync(this.dialogs, Resources.formatHistoryTitle(folder));
    if (name !== null)
      await this.writeAsync(folder, () => this.client.createBranchAsync(folder, name, status.fingerprint));
  }

  /** Fetches every remote of the folder, on the status it read. */
  protected fetchAll(folder: string, status: GitStatus): void {
    void this.writeAsync(folder, () => this.client.fetchAsync(folder, status.fingerprint, true));
  }

  /** Deletes a merged local branch, on the status the menu opened with; Git refuses an unmerged branch or the current one, and the refusal shows under the panel. */
  protected deleteBranch(folder: string, branch: string, status: GitStatus): void {
    void this.writeAsync(folder, () => this.client.deleteBranchAsync(folder, branch, status.fingerprint));
  }

  protected deleteTag(folder: string, tag: string, status: GitStatus): void {
    void this.writeAsync(folder, () => this.client.deleteTagAsync(folder, tag, status.fingerprint));
  }

  /** Runs a write for the person's click, showing Git's refusal under the panel, then reads the panel again; answers whether it was done. */
  private async writeAsync(folder: string, write: () => Promise<void>): Promise<boolean> {
    this.busy.set(true);
    this.failure.set(null);
    let done: boolean = false;
    try {
      await write();
      done = true;
    }
    catch (error) {
      this.report(error);
      if (GitRuntimeClient.isFailure(error))
        this.failure.set(GitViewStateService.messageOf(error));
    }
    finally {
      this.busy.set(false);
      await this.readAsync(folder);
    }
    return done;
  }

  private async readAsync(folder: string): Promise<void> {
    const reading: number = ++this.reading;
    try {
      const [status, branches, worktrees, items] = await Promise.all([
        this.client.statusAsync(folder), this.client.branchesAsync(folder), this.client.worktreesAsync(folder), this.client.repositoryItemsAsync(folder)]);
      if (reading !== this.reading)
        return;
      this.status.set(status);
      this.branches.set(branches);
      this.worktrees.set(worktrees);
      this.items.set(items);
    }
    catch (error) {
      if (reading !== this.reading)
        return;
      this.report(error);
      if (GitRuntimeClient.isFailure(error))
        this.failure.set(GitRuntimeClient.failureOf(error)?.message ?? Resources.historyFailed);
    }
  }

  /** Reads the remote branches' counts after a read of the branches while the remotes show; on a failure the rows show none. */
  private async readRemoteTracksAsync(folder: string, reading: number): Promise<void> {
    try {
      const remote: GitRemoteTracks = await this.client.remoteTracksAsync(folder);
      if (reading === this.remoteReading)
        this.remoteTracks.set(new Map(remote.tracks.map(t => [t.branch, t])));
    }
    catch (error) {
      if (reading !== this.remoteReading)
        return;
      this.remoteTracks.set(new Map());
      this.report(error);
    }
  }

  private report(error: unknown): void {
    if (!GitRuntimeClient.isFailure(error))
      this.errors.handleError(error);
  }
}
