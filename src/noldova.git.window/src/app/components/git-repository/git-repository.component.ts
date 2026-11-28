/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Component, computed, DestroyRef, effect, ErrorHandler, inject, signal, type Signal, untracked, type WritableSignal } from "@angular/core";
import "@noldova/context.core";
import { type IWindowPartContext, WindowPartTokens } from "@noldova/desktop.window";
import { ContextMenuTriggerDirective, DialogService, IconButtonComponent, MenuComponent, MenuItemComponent, MenuSeparatorComponent, SpinnerComponent, TextFieldComponent,
  TooltipDirective } from "@noldova/ui.components.angular";
import { FormsModule } from "@angular/forms";
import type { GitBranches, GitBranchTrack, GitRemote, GitRemoteTracks, GitRepositoryItems, GitStatus, GitTag, GitWorktrees } from "@noldova/git.protocol";

import { GitBranchMenuItem } from "../../models/git-branch-menu-item.ts";
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
import { GitTrackCounts } from "../../models/git-track-counts.ts";

@Component({
  selector: "nol-git-repository",
  imports: [ContextMenuTriggerDirective, FormsModule, GitAgentsComponent, GitPullRequestsComponent, IconButtonComponent, MenuComponent, MenuItemComponent, MenuSeparatorComponent,
    SpinnerComponent, TextFieldComponent, TooltipDirective],
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
  private readonly tracks: Signal<ReadonlyMap<string, GitBranchTrack>> = computed(() => new Map(this.branches()?.tracks.map(t => [t.branch, t])));
  private readonly worktrees: WritableSignal<GitWorktrees | null> = signal<GitWorktrees | null>(null);
  protected readonly items: WritableSignal<GitRepositoryItems | null> = signal<GitRepositoryItems | null>(null);
  private readonly opened: WritableSignal<ReadonlySet<string>> = signal<ReadonlySet<string>>(new Set([Resources.branchesLabel]));
  private reading = 0;
  protected readonly renaming: WritableSignal<string | null> = signal<string | null>(null);
  protected readonly newName: WritableSignal<string> = signal("");

  protected readonly resources: typeof Resources = Resources;
  protected readonly folder: Signal<string | null> = GitFolder.folder;
  protected readonly failure: WritableSignal<string | null> = signal<string | null>(null);
  protected readonly busy: WritableSignal<boolean> = signal(false);
  protected readonly isRepository: WritableSignal<boolean> = signal(true);
  protected readonly isReading: Signal<boolean> = computed(() => Object.isNull(this.branches()) && Object.isNull(this.failure()) && this.isRepository());
  protected readonly readingIndent: number = Resources.rowInsetRem + Resources.treeStepRem;
  protected readonly changes: Signal<number> = computed(() => this.status()?.entries.length ?? 0);
  protected readonly links: Signal<readonly GitRepositoryLink[]> = computed(() => {
    const remote: GitRemote | null = this.status()?.remote ?? null;
    return Object.isNull(remote) ? [] : GitRepositoryLinks.of(remote);
  });
  protected readonly showsLink: Signal<boolean> = computed(() => this.links().some(t => t.isActive()));
  protected readonly showsCommit: Signal<boolean> = computed(() => !Object.isNull(GitViewing.commitOf(this.folder())));
  protected readonly switching: Signal<string | null> = computed(() => GitPendingSwitch.branchOf(this.folder()));
  protected readonly current: Signal<string | null> = computed(() => this.switching() ?? this.branches()?.current ?? null);
  protected readonly switchable: Signal<GitStatus | null> = computed(() => this.busy() ? null : this.status());
  protected readonly ahead: Signal<number> = computed(() => this.status()?.upstream?.ahead ?? 0);
  protected readonly behind: Signal<number> = computed(() => this.status()?.upstream?.behind ?? 0);
  protected readonly localRows: Signal<readonly GitBranchRow[]> = computed(() =>
    GitBranchTree.localRowsOf(Resources.localTreeKey, this.branches()?.branches ?? [], this.opened()));
  protected readonly remotes: Signal<readonly string[]> = computed(() => this.branches()?.remotes ?? []);
  protected readonly remoteRows: Signal<readonly GitBranchRow[]> = computed(() =>
    GitBranchTree.remoteRowsOf(this.remotes(), this.branches()?.remoteBranches ?? [], this.opened()));
  private readonly remotesOpen: Signal<boolean> = computed(() => this.opened().has(Resources.remotesLabel));
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
      this.isRepository.set(true);
      if (Object.isNull(folder))
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
      if (Object.isNull(branches))
        this.remoteTracks.set(new Map());
      if (Object.isNull(folder) || Object.isNull(branches) || !this.remotesOpen())
        return;
      untracked(() => void this.readRemoteTracksAsync(folder, reading));
    });
    inject(DestroyRef).onDestroy(this.client.onChanged(folder => {
      if (folder === this.folder())
        void this.readAsync(folder);
    }));
  }

  protected countsOf(branch: string, isCurrent: boolean): GitTrackCounts {
    if (isCurrent)
      return new GitTrackCounts(this.ahead(), this.behind());
    const track: GitBranchTrack | undefined = this.tracks().get(branch);
    return Object.isUndefined(track) ? GitTrackCounts.NONE : new GitTrackCounts(track.ahead, track.behind);
  }

  protected remoteCountsOf(branch: string): GitTrackCounts {
    const track: GitBranchTrack | undefined = this.remoteTracks().get(branch);
    return Object.isUndefined(track) ? GitTrackCounts.NONE : new GitTrackCounts(track.ahead, track.behind);
  }

  protected indentOf(row: GitBranchRow): number {
    return Resources.rowInsetRem + row.depth * Resources.treeStepRem;
  }

  protected isViewed(branch: string, isRemote: boolean): boolean {
    const view: GitBranchView | null = GitViewing.branchOf(this.folder());
    return !Object.isNull(view) && view.branch === branch && view.isRemote === isRemote;
  }

  protected isTagViewed(tag: GitTag): boolean {
    const view: GitBranchView | null = GitViewing.branchOf(this.folder());
    return !Object.isNull(view) && view.branch === "" && view.commitId === tag.id;
  }

  protected viewTag(folder: string, tag: GitTag): void {
    GitViewing.branch.set(new GitBranchView(folder, "", false, tag.id));
    GitCommitDetails.of(this.context).bringForward();
    this.history(folder);
  }

  protected view(folder: string, branch: string, isRemote: boolean): void {
    GitViewing.branch.set(new GitBranchView(folder, branch, isRemote));
    GitCommitDetails.of(this.context).bringForward();
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

  protected showChanges(): void {
    GitViewing.showChanges(this.folder());
    this.context.showView(Resources.viewName);
  }

  protected showHistory(folder: string): void {
    const viewed: GitBranchView | null = GitViewing.branchOf(folder);
    const head: string | null = this.status()?.head ?? null;
    if (!Object.isNull(viewed) && viewed.branch !== "")
      GitViewing.branch.set(new GitBranchView(folder, viewed.branch, viewed.isRemote));
    else if (!Object.isNull(head))
      GitViewing.branch.set(new GitBranchView(folder, "", false, head));
    GitCommitDetails.of(this.context).bringForward();
    this.history(folder);
  }

  protected history(folder: string): void {
    this.context.openDocument(Resources.historyDocumentName, folder, Resources.formatHistoryTitle(folder));
  }

  protected localNameOf(branch: string): string {
    return GitBranchMenuItem.localNameOf(branch, this.remotes());
  }

  protected switchTo(folder: string, name: string): void {
    const status: GitStatus | null = this.switchable();
    if (Object.isNull(status) || name === this.current())
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

  protected async renameAsync(folder: string, branch: string, newName: string): Promise<void> {
    const status: GitStatus | null = this.switchable();
    const name: string = newName.trim();
    if (Object.isNull(status) || name.length === 0)
      return;
    if (name === branch) {
      this.renaming.set(null);
      return;
    }
    if (await this.writeAsync(folder, () => this.client.renameBranchAsync(folder, branch, name, status.fingerprint)))
      this.renaming.set(null);
  }

  protected async newBranchAsync(folder: string, status: GitStatus): Promise<void> {
    const name: string | null = await GitNewBranch.askAsync(this.dialogs, Resources.formatHistoryTitle(folder));
    if (!Object.isNull(name))
      await this.writeAsync(folder, () => this.client.createBranchAsync(folder, name, status.fingerprint));
  }

  protected fetchAll(folder: string, status: GitStatus): void {
    void this.writeAsync(folder, () => this.client.fetchAsync(folder, status.fingerprint, true));
  }

  protected deleteBranch(folder: string, branch: string, status: GitStatus): void {
    void this.writeAsync(folder, () => this.client.deleteBranchAsync(folder, branch, status.fingerprint));
  }

  protected deleteTag(folder: string, tag: string, status: GitStatus): void {
    void this.writeAsync(folder, () => this.client.deleteTagAsync(folder, tag, status.fingerprint));
  }

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
      if (folder === this.folder())
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
      this.isRepository.set(true);
    }
    catch (error) {
      if (reading !== this.reading)
        return;
      this.report(error);
      if (GitRuntimeClient.isNotRepository(error))
        this.isRepository.set(false);
      else if (GitRuntimeClient.isFailure(error))
        this.failure.set(GitRuntimeClient.failureOf(error)?.message ?? Resources.historyFailed);
    }
  }

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
