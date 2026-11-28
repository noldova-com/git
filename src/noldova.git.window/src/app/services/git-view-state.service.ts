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
import { GitSigningRead } from "../models/git-signing-read.ts";

@Injectable()
export class GitViewStateService {
  private readonly context: IWindowPartContext = inject(WindowPartTokens.context);
  private readonly client: GitRuntimeClient = new GitRuntimeClient(this.context);
  private readonly errors: ErrorHandler = inject(ErrorHandler);
  private readonly diffs: Map<string, Promise<GitDiff>> = new Map();
  private reads: number = 0;
  private opened: number = 0;
  private branchLoads: number = 0;
  private prefilled: string = "";
  private signingReads: number = 0;
  private readonly signing: WritableSignal<GitSigningRead | null> = signal<GitSigningRead | null>(null);

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
  public readonly discarded: WritableSignal<GitJournalEntry | null> = signal(null);
  public readonly forcePushOffer: WritableSignal<GitForcePushOffer | null> = signal(null);
  public readonly fetchOffered: WritableSignal<boolean> = signal(false);
  public readonly recentActions: WritableSignal<readonly GitJournalEntry[]> = signal([]);
  public readonly fileLayout: WritableSignal<GitFileLayout> = signal(GitFileLayout.Folders);
  public readonly message: WritableSignal<string> = signal("");
  public readonly amending: WritableSignal<boolean> = signal(false);
  public readonly groups: Signal<readonly GitFileGroup[]> = computed(() => GitFileGroup.groupsOf(this.status()?.entries ?? []));
  public readonly conflicts: Signal<number> = computed(() => this.countOf(GitFileGroupKind.Conflicts));
  public readonly staged: Signal<number> = computed(() => this.countOf(GitFileGroupKind.Staged));
  public readonly commitSigning: Signal<GitCommitSigning | null> = computed(() => {
    const read = this.signing();
    return !Object.isNull(read) && read.folder === this.folder() ? read.signing : null;
  });
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

  public async loadSigningAsync(): Promise<void> {
    const folder: string | null = this.folder();
    if (Object.isNull(folder))
      return;
    const read: number = ++this.signingReads;
    try {
      const signing: GitCommitSigning = await this.client.commitSigningAsync(folder);
      if (read === this.signingReads)
        this.signing.set(new GitSigningRead(folder, signing));
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

  public conflictAsync(path: string): Promise<GitConflict> {
    const folder: string | null = this.folder();
    return Object.isNull(folder) ? Promise.reject(new StatusMissingException()) : this.client.conflictAsync(folder, path);
  }

  public markerCheckAsync(): Promise<GitMarkerCheck> {
    const folder: string | null = this.folder();
    return Object.isNull(folder) ? Promise.reject(new StatusMissingException()) : this.client.markerCheckAsync(folder);
  }

  public resolveConflictAsync(path: string, resolution: ConflictResolution, text: string | null): Promise<void> {
    return this.writeAsync((folder, basedOn) => this.client.resolveConflictAsync(folder, path, resolution, text, basedOn));
  }

  public continueOperationAsync(): Promise<void> {
    return this.writeAsync((folder, basedOn) => this.client.continueOperationAsync(folder, basedOn));
  }

  public abortOperationAsync(): Promise<void> {
    return this.writeAsync((folder, basedOn) => this.client.abortOperationAsync(folder, basedOn));
  }

  public skipOperationAsync(): Promise<void> {
    return this.writeAsync((folder, basedOn) => this.client.skipOperationAsync(folder, basedOn));
  }

  public stageAsync(paths: readonly string[]): Promise<void> {
    return this.writeAsync((folder, basedOn) => this.client.stageAsync(folder, paths, basedOn));
  }

  public unstageAsync(paths: readonly string[]): Promise<void> {
    return this.writeAsync((folder, basedOn) => this.client.unstageAsync(folder, paths, basedOn));
  }

  public discardAsync(paths: readonly string[]): Promise<void> {
    return this.writeAsync(async (folder, basedOn) => {
      await this.client.discardAsync(folder, paths, basedOn);
      const entry: GitJournalEntry | null = (await this.readJournalAsync(folder))?.entries.at(-1) ?? null;
      this.discarded.set(entry?.undo === UndoMode.Checkpoint ? entry : null);
    });
  }

  public undoDiscardAsync(): Promise<void> {
    const entry: GitJournalEntry | null = this.discarded();
    return Object.isNull(entry) ? Promise.resolve() : this.undoEntryAsync(entry);
  }

  public undoEntryAsync(entry: GitJournalEntry): Promise<void> {
    return this.writeAsync((folder, basedOn) => this.client.undoAsync(folder, entry.id, basedOn));
  }

  public async readRecentActionsAsync(): Promise<void> {
    const folder: string | null = this.folder();
    const journal: GitJournal | null = Object.isNull(folder) ? null : await this.readJournalAsync(folder);
    if (!Object.isNull(journal) && folder === this.folder())
      this.recentActions.set([...journal.entries].reverse());
  }

  public async canUndoDiscardAsync(): Promise<boolean> {
    const folder: string | null = this.folder();
    return !Object.isNull(folder) && (await this.readJournalAsync(folder))?.checkpoints === true;
  }

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

  public fetchAsync(): Promise<void> {
    return this.writeAsync((folder, basedOn) => this.client.fetchAsync(folder, basedOn));
  }

  public forcePushAsync(offer: GitForcePushOffer): Promise<void> {
    return this.writeAsync((folder, basedOn) => this.client.forcePushAsync(folder, offer.expected, basedOn));
  }

  public async createBranchAtAsync(name: string, id: string): Promise<boolean> {
    let made: boolean = false;
    await this.writeAsync(async (folder, basedOn) => {
      await this.client.createBranchAtAsync(folder, name, id, basedOn);
      made = true;
    });
    return made;
  }

  public async rebaseAsync(onto: string, steps: readonly RebaseStep[], updateRefs: boolean): Promise<boolean> {
    let ran: boolean = false;
    await this.writeAsync(async (folder, basedOn) => {
      await this.client.rebaseAsync(folder, onto, steps, updateRefs, basedOn);
      ran = true;
    });
    return ran;
  }

  public async createTagAsync(name: string, id: string): Promise<boolean> {
    let made: boolean = false;
    await this.writeAsync(async (folder, basedOn) => {
      await this.client.createTagAsync(folder, name, id, basedOn);
      made = true;
    });
    return made;
  }

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
