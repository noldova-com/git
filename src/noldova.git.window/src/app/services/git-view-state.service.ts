/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { computed, DestroyRef, effect, ErrorHandler, inject, Injectable, signal, type Signal, untracked, type WritableSignal } from "@angular/core";
import "@noldova/context.core";
import { type IWindowPartContext, WindowPartTokens } from "@noldova/desktop.window";
import {
  type ConflictResolution, DiffScope, type DiffScopeKind, FailureCode, type GitBranches, GitCode, type GitCommitSigning, type GitConflict, type GitDiff, type GitFailure, type GitHooks,
  type GitJournal, type GitJournalEntry, type GitMarkerCheck, type GitStatus, type RebaseStep, UndoMode
} from "@noldova/git.protocol";

import { GitFileGroupKind } from "../enums/git-file-group-kind.ts";
import { GitFileLayout } from "../enums/git-file-layout.ts";
import { GitViewPhase } from "../enums/git-view-phase.ts";
import { StatusMissingException } from "../exceptions/status-missing.exception.ts";
import { GitFileGroup } from "../models/git-file-group.ts";
import { GitForcePushOffer } from "../models/git-force-push-offer.ts";
import { Resources } from "../../resources.ts";
import { GitCommitPrefixes } from "./git-commit-prefixes.ts";
import { GitFolder } from "./git-folder.ts";
import { GitPendingSwitch } from "./git-pending-switch.ts";
import { GitRuntimeClient } from "./git-runtime-client.ts";

@Injectable()
export class GitViewStateService {
  private readonly context: IWindowPartContext = inject(WindowPartTokens.context);
  private readonly client: GitRuntimeClient = new GitRuntimeClient(this.context);
  private readonly errors: ErrorHandler = inject(ErrorHandler);
  private readonly diffs: Map<string, Promise<GitDiff>> = new Map();
  private reads: number = 0;
  private opened: number = 0;
  private branchLoads: number = 0;
  /** The prefix the message was last filled with, so that a message still holding it untouched counts as empty. */
  private prefilled: string = "";
  /** Counts the signing reads, so that only the newest one's answer shows. */
  private signingReads: number = 0;
  /** The last signing read's answer and the folder it is for. */
  private readonly signing: WritableSignal<{ readonly folder: string; readonly signing: GitCommitSigning } | null> = signal(null);

  public readonly folder: Signal<string | null> = GitFolder.folder;
  public readonly folderFailure: Signal<string | null> = GitFolder.failure;
  public readonly phase: WritableSignal<GitViewPhase> = signal(GitViewPhase.NoFolder);
  public readonly status: WritableSignal<GitStatus | null> = signal(null);
  public readonly branches: WritableSignal<GitBranches | null> = signal(null);
  public readonly pullHooks: WritableSignal<readonly string[] | null> = signal(null);
  public readonly failure: WritableSignal<string | null> = signal(null);
  public readonly watchFailure: WritableSignal<string | null> = signal(null);
  public readonly readFolder: WritableSignal<string> = signal("");
  public readonly readFailure: WritableSignal<string> = signal("");
  public readonly gitVersion: WritableSignal<string | null> = signal(null);
  public readonly busy: WritableSignal<boolean> = signal(false);
  /** The last discard, while it can still be undone from the checkpoint taken before it: until the next write or another folder. */
  public readonly discarded: WritableSignal<GitJournalEntry | null> = signal(null);
  /** The force push offered after a push was refused as behind, until the next write or another folder. */
  public readonly forcePushOffer: WritableSignal<GitForcePushOffer | null> = signal(null);
  /** Whether the view offers a fetch, after the remote refused a push for commits the last fetch hadn't seen; until the next write or another folder. */
  public readonly fetchOffered: WritableSignal<boolean> = signal(false);
  /** The repository's recent writes, newest first, all the journal keeps, as the last read of the journal found them. */
  public readonly recentActions: WritableSignal<readonly GitJournalEntry[]> = signal([]);
  /** How the lists of changed files are laid out; the file groups and the commit's files all follow it. */
  public readonly fileLayout: WritableSignal<GitFileLayout> = signal(GitFileLayout.Folders);
  public readonly message: WritableSignal<string> = signal("");
  /** Whether the commit card amends the last commit rather than making a new one. */
  public readonly amending: WritableSignal<boolean> = signal(false);
  public readonly groups: Signal<readonly GitFileGroup[]> = computed(() => GitFileGroup.groupsOf(this.status()?.entries ?? []));
  public readonly conflicts: Signal<number> = computed(() => this.countOf(GitFileGroupKind.Conflicts));
  public readonly staged: Signal<number> = computed(() => this.countOf(GitFileGroupKind.Staged));
  /** Whether git signs a new commit in the folder's repository, and in which format; null until it is read for this folder, or when it can't be. */
  public readonly commitSigning: Signal<GitCommitSigning | null> = computed(() => {
    const read = this.signing();
    return !Object.isNull(read) && read.folder === this.folder() ? read.signing : null;
  });
  /** The prefix a host gives a new commit's message on the current branch, or null without one, a folder or a branch. */
  public readonly prefix: Signal<string | null> = computed(() => {
    const folder: string | null = this.folder();
    const branch: string | null = this.status()?.branch ?? null;
    return Object.isNull(folder) || Object.isNull(branch) ? null : GitCommitPrefixes.prefixFor(folder, branch);
  });

  public constructor() {
    const destroyed: DestroyRef = inject(DestroyRef);
    effect(onCleanup => {
      const folder: string | null = this.folder();
      this.folderFailure();
      untracked(() => void this.openAsync(folder));
      if (!Object.isNull(folder))
        onCleanup(() => void this.unwatchAsync(folder));
    });
    effect(() => {
      const prefix: string = this.prefix() ?? "";
      untracked(() => {
        if (!this.amending() && this.isUntouched())
          this.fillMessage(prefix);
      });
    });
    destroyed.onDestroy(this.client.onChanged(t => {
      if (t === this.folder())
        void this.refreshAsync();
    }));
    const focused = (): void => void (this.phase() === GitViewPhase.NotRepository ? this.followAgainAsync() : this.loadSigningAsync());
    window.addEventListener("focus", focused);
    destroyed.onDestroy(() => window.removeEventListener("focus", focused));
  }

  public static messageOf(error: unknown): string {
    return GitRuntimeClient.failureOf(error)?.message ?? (error instanceof Error ? error.message : String(error));
  }

  public async refreshAsync(): Promise<void> {
    const folder: string | null = this.folder();
    const read: number = ++this.reads;
    if (Object.isNull(folder)) {
      this.showNoFolder();
      return;
    }
    this.readFolder.set(folder);
    try {
      const status: GitStatus = await this.client.statusAsync(folder);
      if (read !== this.reads)
        return;
      if (this.phase() !== GitViewPhase.Ready)
        this.failure.set(null);
      this.show(GitViewPhase.Ready, status);
      void this.loadSigningAsync();
    }
    catch (error) {
      if (!GitRuntimeClient.isFailure(error))
        throw error;
      if (read === this.reads)
        this.showFailure(error);
    }
  }

  public async loadBranchesAsync(): Promise<void> {
    const folder: string | null = this.folder();
    if (Object.isNull(folder))
      return;
    const opened: number = this.opened;
    const load: number = ++this.branchLoads;
    const isCurrent = (): boolean => opened === this.opened && load === this.branchLoads;
    try {
      const branches: GitBranches = await this.client.branchesAsync(folder);
      if (isCurrent())
        this.branches.set(branches);
    }
    catch (error) {
      if (!GitRuntimeClient.isFailure(error))
        throw error;
      if (isCurrent())
        this.failure.set(GitViewStateService.messageOf(error));
    }
  }

  /**
   * Reads how the folder's repository signs commits, with each status read and when the window takes the focus, since Git's configuration can change
   * without a change event; the last answer for the folder stays while the read runs, only the newest read's answer shows, and a failure is logged.
   */
  public async loadSigningAsync(): Promise<void> {
    const folder: string | null = this.folder();
    if (Object.isNull(folder))
      return;
    const read: number = ++this.signingReads;
    try {
      const signing: GitCommitSigning = await this.client.commitSigningAsync(folder);
      if (read === this.signingReads)
        this.signing.set({ folder, signing });
    }
    catch (error) {
      if (!GitRuntimeClient.isFailure(error))
        throw error;
      this.context.log(Resources.formatSigningFailed(GitViewStateService.messageOf(error)));
    }
  }

  public async loadPullHooksAsync(): Promise<void> {
    const folder: string | null = this.folder();
    if (Object.isNull(folder) || !Object.isNull(this.pullHooks()))
      return;
    const opened: number = this.opened;
    try {
      const hooks: GitHooks = await this.client.pullHooksAsync(folder);
      if (opened === this.opened)
        this.pullHooks.set(hooks.hooks);
    }
    catch (error) {
      if (!GitRuntimeClient.isFailure(error))
        throw error;
      if (opened === this.opened)
        this.context.log(Resources.formatPullHooksFailed(GitViewStateService.messageOf(error)));
    }
  }

  public diffAsync(scope: DiffScopeKind): Promise<GitDiff> {
    const folder: string | null = this.folder();
    const status: GitStatus | null = this.status();
    if (Object.isNull(folder) || Object.isNull(status))
      return Promise.reject(new StatusMissingException());
    const key: string = Resources.formatDiffKey(status.fingerprint, scope);
    const known: Promise<GitDiff> | undefined = this.diffs.get(key);
    if (!Object.isUndefined(known))
      return known;
    const diff: Promise<GitDiff> = this.client.diffAsync(folder, new DiffScope(scope));
    this.diffs.set(key, diff);
    void diff.catch(() => this.diffs.delete(key));
    return diff;
  }

  /** Reads a conflicted file's stages, Git's merge of them and its sides' names. */
  public conflictAsync(path: string): Promise<GitConflict> {
    const folder: string | null = this.folder();
    return Object.isNull(folder) ? Promise.reject(new StatusMissingException()) : this.client.conflictAsync(folder, path);
  }

  /** Finds the tracked files, staged or not, that still have a conflict marker line. */
  public markerCheckAsync(): Promise<GitMarkerCheck> {
    const folder: string | null = this.folder();
    return Object.isNull(folder) ? Promise.reject(new StatusMissingException()) : this.client.markerCheckAsync(folder);
  }

  /** Resolves a conflicted file with its resolved text, one side's whole file, or its deletion, and stages it. */
  public resolveConflictAsync(path: string, resolution: ConflictResolution, text: string | null): Promise<void> {
    return this.writeAsync((folder, basedOn) => this.client.resolveConflictAsync(folder, path, resolution, text, basedOn));
  }

  public continueOperationAsync(): Promise<void> {
    return this.writeAsync((folder, basedOn) => this.client.continueOperationAsync(folder, basedOn));
  }

  public abortOperationAsync(): Promise<void> {
    return this.writeAsync((folder, basedOn) => this.client.abortOperationAsync(folder, basedOn));
  }

  public stageAsync(paths: readonly string[]): Promise<void> {
    return this.writeAsync((folder, basedOn) => this.client.stageAsync(folder, paths, basedOn));
  }

  public unstageAsync(paths: readonly string[]): Promise<void> {
    return this.writeAsync((folder, basedOn) => this.client.unstageAsync(folder, paths, basedOn));
  }

  /** Discards paths' working-folder changes, then offers to undo it when the runtime took a checkpoint first. */
  public discardAsync(paths: readonly string[]): Promise<void> {
    return this.writeAsync(async (folder, basedOn) => {
      await this.client.discardAsync(folder, paths, basedOn);
      const entry: GitJournalEntry | null = (await this.readJournalAsync(folder))?.entries.at(-1) ?? null;
      this.discarded.set(entry?.undo === UndoMode.Checkpoint ? entry : null);
    });
  }

  /** Puts the last discard's paths back from its checkpoint. */
  public undoDiscardAsync(): Promise<void> {
    const entry: GitJournalEntry | null = this.discarded();
    return Object.isNull(entry) ? Promise.resolve() : this.undoEntryAsync(entry);
  }

  /** Undoes one write of the journal; the runtime refuses one that can't be undone, or whose refs or index moved since. */
  public undoEntryAsync(entry: GitJournalEntry): Promise<void> {
    return this.writeAsync((folder, basedOn) => this.client.undoAsync(folder, entry.id, basedOn));
  }

  /** Reads the journal again for the recent actions, keeping the last list when it can't be read. */
  public async readRecentActionsAsync(): Promise<void> {
    const folder: string | null = this.folder();
    const journal: GitJournal | null = Object.isNull(folder) ? null : await this.readJournalAsync(folder);
    if (!Object.isNull(journal) && folder === this.folder())
      this.recentActions.set([...journal.entries].reverse());
  }

  /** Whether a discard now takes a checkpoint first, so it can be undone; false when the journal can't be read. */
  public async canUndoDiscardAsync(): Promise<boolean> {
    const folder: string | null = this.folder();
    return !Object.isNull(folder) && (await this.readJournalAsync(folder))?.checkpoints === true;
  }

  /** Stages the chosen lines of one file's worktree changes, or unstages them from its staged ones, as the diff numbers them. */
  public stageLinesAsync(path: string, lines: readonly number[], staged: boolean): Promise<void> {
    return this.writeAsync((folder, basedOn) => staged ? this.client.unstageLinesAsync(folder, path, lines, basedOn) : this.client.stageLinesAsync(folder, path, lines, basedOn));
  }

  public async switchBranchAsync(name: string): Promise<void> {
    const folder: string | null = this.folder();
    if (Object.isNull(folder))
      return;
    await GitPendingSwitch.runAsync(folder, name, () => this.writeAsync((at, basedOn) => this.client.switchBranchAsync(at, name, basedOn)));
  }

  public createBranchAsync(name: string): Promise<void> {
    return this.writeAsync((folder, basedOn) => this.client.createBranchAsync(folder, name, basedOn));
  }

  /**
   * Pushes the branch. Refused because the upstream has commits the branch doesn't, it offers a force push over the commit the status shows there
   * when the last fetch saw them, and otherwise, the remote having refused it, a fetch.
   */
  public pushAsync(): Promise<void> {
    const offer: GitForcePushOffer | null = GitForcePushOffer.of(this.status());
    return this.writeAsync(async (folder, basedOn) => {
      const opened: number = this.opened;
      try {
        await this.client.pushAsync(folder, basedOn);
      }
      catch (error) {
        if (opened === this.opened && GitRuntimeClient.failureOf(error)?.gitCode === GitCode.PushBehind) {
          this.forcePushOffer.set(offer);
          this.fetchOffered.set(Object.isNull(offer));
        }
        throw error;
      }
    });
  }

  /** Fetches the current branch's remote, so the status shows its upstream as the remote has it. */
  public fetchAsync(): Promise<void> {
    return this.writeAsync((folder, basedOn) => this.client.fetchAsync(folder, basedOn));
  }

  /** Force pushes over the upstream's commits, only while the remote still points at the commit the offer showed. */
  public forcePushAsync(offer: GitForcePushOffer): Promise<void> {
    return this.writeAsync((folder, basedOn) => this.client.forcePushAsync(folder, offer.expected, basedOn));
  }

  /** Makes a branch at the commit, and answers whether it was made. */
  public async createBranchAtAsync(name: string, id: string): Promise<boolean> {
    let made: boolean = false;
    await this.writeAsync(async (folder, basedOn) => {
      await this.client.createBranchAtAsync(folder, name, id, basedOn);
      made = true;
    });
    return made;
  }

  /** Rebases the current branch onto the commit with the steps, and answers whether it ran to its end or to an edit step; a stop on conflicts fails, as a pick does, with the failure shown. */
  public async rebaseAsync(onto: string, steps: readonly RebaseStep[], updateRefs: boolean): Promise<boolean> {
    let ran: boolean = false;
    await this.writeAsync(async (folder, basedOn) => {
      await this.client.rebaseAsync(folder, onto, steps, updateRefs, basedOn);
      ran = true;
    });
    return ran;
  }

  /** Makes a tag at the commit, and answers whether it was made. */
  public async createTagAsync(name: string, id: string): Promise<boolean> {
    let made: boolean = false;
    await this.writeAsync(async (folder, basedOn) => {
      await this.client.createTagAsync(folder, name, id, basedOn);
      made = true;
    });
    return made;
  }

  /** Turns amending on with the last commit's whole message in the field, or off with the field emptied; the message stays when it can't be read. */
  public async setAmendingAsync(amending: boolean): Promise<void> {
    const folder: string | null = this.folder();
    const head: string | null = this.status()?.head ?? null;
    this.amending.set(amending);
    if (!amending) {
      this.fillMessage(this.prefix() ?? "");
      return;
    }
    if (Object.isNull(folder) || Object.isNull(head))
      return;
    try {
      const [log, detail] = await Promise.all([this.client.logAsync(folder, 1), this.client.commitDetailAsync(folder, head)]);
      const subject: string = log.commits[0]?.subject ?? "";
      if (this.amending() && this.isUntouched())
        this.message.set(detail.body.length === 0 ? subject : `${subject}\n\n${detail.body}`);
    }
    catch (error) {
      if (!GitRuntimeClient.isFailure(error))
        this.errors.handleError(error);
    }
  }

  public cherryPickAsync(id: string): Promise<void> {
    return this.writeAsync((folder, basedOn) => this.client.cherryPickAsync(folder, id, basedOn));
  }

  public mergeAsync(id: string): Promise<void> {
    return this.writeAsync((folder, basedOn) => this.client.mergeAsync(folder, id, basedOn));
  }

  public revertAsync(id: string): Promise<void> {
    return this.writeAsync((folder, basedOn) => this.client.revertAsync(folder, id, basedOn));
  }

  public pullAsync(): Promise<void> {
    return this.writeAsync((folder, basedOn) => this.client.pullAsync(folder, basedOn));
  }

  public async followAgainAsync(): Promise<void> {
    const folder: string | null = this.folder();
    if (Object.isNull(folder))
      return;
    this.watchFailure.set(null);
    await this.watchAsync(folder);
    await this.refreshAsync();
  }

  public async commitAsync(message: string): Promise<boolean> {
    const opened: number = this.opened;
    let committed: boolean = false;
    const amending: boolean = this.amending();
    await this.writeAsync(async (folder, basedOn) => {
      await (amending ? this.client.amendAsync(folder, message, basedOn) : this.client.commitAsync(folder, message, basedOn));
      committed = true;
    });
    if (!committed || opened !== this.opened)
      return false;
    this.amending.set(false);
    this.fillMessage(this.prefix() ?? "");
    return true;
  }

  public async commitAndPushAsync(message: string): Promise<void> {
    if (await this.commitAsync(message))
      await this.pushAsync();
  }

  private isUntouched(): boolean {
    const message: string = this.message();
    return message.length === 0 || message === this.prefilled;
  }

  private fillMessage(prefix: string): void {
    this.prefilled = prefix;
    this.message.set(prefix);
  }

  private async openAsync(folder: string | null): Promise<void> {
    this.opened++;
    this.branchLoads++;
    this.branches.set(null);
    this.pullHooks.set(null);
    this.failure.set(null);
    this.watchFailure.set(null);
    this.discarded.set(null);
    this.forcePushOffer.set(null);
    this.fetchOffered.set(false);
    this.recentActions.set([]);
    this.message.set("");
    this.diffs.clear();
    if (!Object.isNull(folder)) {
      this.phase.set(GitViewPhase.Loading);
      this.status.set(null);
      void this.watchAsync(folder);
    }
    await this.refreshAsync();
  }

  /** Watches the folder; a folder that isn't a repository is no failure, since the view says so, and the window's focus checks it again. */
  private async watchAsync(folder: string): Promise<void> {
    const opened: number = this.opened;
    try {
      await this.client.watchAsync(folder);
    }
    catch (error) {
      if (!GitRuntimeClient.isFailure(error))
        throw error;
      if (GitRuntimeClient.failureOf(error)?.code === FailureCode.NotRepository)
        return;
      this.context.log(Resources.formatWatchFailed(String(error)));
      if (opened === this.opened)
        this.watchFailure.set(Resources.formatWatchFailed(GitViewStateService.messageOf(error)));
    }
  }

  private async unwatchAsync(folder: string): Promise<void> {
    try {
      await this.client.unwatchAsync(folder);
    }
    catch (error) {
      if (GitRuntimeClient.isFailure(error))
        this.context.log(Resources.formatUnwatchFailed(folder, String(error)));
      else
        this.errors.handleError(error);
    }
  }

  /** The folder's journal, or null when the runtime can't read it. */
  private async readJournalAsync(folder: string): Promise<GitJournal | null> {
    try {
      return await this.client.journalAsync(folder);
    }
    catch (error) {
      if (!GitRuntimeClient.isFailure(error))
        throw error;
      return null;
    }
  }

  private async writeAsync(write: (folder: string, basedOn: string) => Promise<void>): Promise<void> {
    const folder: string | null = this.folder();
    const status: GitStatus | null = this.status();
    if (Object.isNull(folder) || Object.isNull(status) || this.busy())
      return;
    const opened: number = this.opened;
    this.busy.set(true);
    this.failure.set(null);
    this.discarded.set(null);
    this.forcePushOffer.set(null);
    this.fetchOffered.set(false);
    try {
      await write(folder, status.fingerprint);
    }
    catch (error) {
      if (!GitRuntimeClient.isFailure(error))
        throw error;
      if (opened === this.opened && GitRuntimeClient.failureOf(error)?.code !== FailureCode.Stale)
        this.failure.set(GitViewStateService.messageOf(error));
    }
    finally {
      this.busy.set(false);
    }
    if (opened !== this.opened)
      return;
    this.branchLoads++;
    this.branches.set(null);
    await this.refreshAsync();
  }

  private show(phase: GitViewPhase, status: GitStatus | null): void {
    this.phase.set(phase);
    this.status.set(status);
  }

  private showNoFolder(): void {
    const failure: string | null = this.folderFailure();
    this.show(Object.isNull(failure) ? GitViewPhase.NoFolder : GitViewPhase.FolderFailed, null);
    this.readFailure.set(failure ?? "");
  }

  private showFailure(error: unknown): void {
    const failure: GitFailure | null = GitRuntimeClient.failureOf(error);
    this.show(GitViewStateService.phaseOf(failure), null);
    this.failure.set(GitViewStateService.messageOf(error));
    this.readFailure.set(GitViewStateService.messageOf(error));
    this.gitVersion.set(failure?.gitVersion ?? null);
  }

  private countOf(kind: GitFileGroupKind): number {
    return this.groups().find(t => t.kind === kind)?.rows.length ?? 0;
  }

  private static phaseOf(failure: GitFailure | null): GitViewPhase {
    if (failure?.code === FailureCode.NotRepository)
      return GitViewPhase.NotRepository;
    if (failure?.gitCode === GitCode.FolderUnreadable)
      return GitViewPhase.FolderUnreadable;
    if (failure?.gitCode === GitCode.GitMissing)
      return GitViewPhase.GitMissing;
    if (failure?.gitCode === GitCode.GitTooOld)
      return GitViewPhase.GitTooOld;
    return GitViewPhase.Failed;
  }
}
