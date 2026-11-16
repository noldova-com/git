/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { computed, DestroyRef, effect, ErrorHandler, inject, Injectable, signal, type Signal, untracked, type WritableSignal } from "@angular/core";
import { type IWindowPartContext, WindowPartTokens } from "@noldova/desktop.window";
import {
  DiffScope, type DiffScopeKind, FailureCode, type GitBranches, GitCode, type GitDiff, type GitFailure, type GitHooks, type GitStatus
} from "@noldova/git.protocol";

import { GitFileGroupKind } from "../enums/git-file-group-kind.ts";
import { GitViewPhase } from "../enums/git-view-phase.ts";
import { StatusMissingException } from "../exceptions/status-missing.exception.ts";
import { GitFileGroup } from "../models/git-file-group.ts";
import { Resources } from "../../resources.ts";
import { GitFolder } from "./git-folder.ts";
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
  public readonly message: WritableSignal<string> = signal("");
  public readonly groups: Signal<readonly GitFileGroup[]> = computed(() => GitFileGroup.groupsOf(this.status()?.entries ?? []));
  public readonly conflicts: Signal<number> = computed(() => this.countOf(GitFileGroupKind.Conflicts));
  public readonly staged: Signal<number> = computed(() => this.countOf(GitFileGroupKind.Staged));

  public constructor() {
    const destroyed: DestroyRef = inject(DestroyRef);
    effect(onCleanup => {
      const folder: string | null = this.folder();
      this.folderFailure();
      untracked(() => void this.openAsync(folder));
      if (folder !== null)
        onCleanup(() => void this.unwatchAsync(folder));
    });
    destroyed.onDestroy(this.client.onChanged(t => {
      if (t === this.folder())
        void this.refreshAsync();
    }));
  }

  public static messageOf(error: unknown): string {
    return GitRuntimeClient.failureOf(error)?.message ?? (error instanceof Error ? error.message : String(error));
  }

  public async refreshAsync(): Promise<void> {
    const folder: string | null = this.folder();
    const read: number = ++this.reads;
    if (folder === null) {
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
    if (folder === null)
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

  public async loadPullHooksAsync(): Promise<void> {
    const folder: string | null = this.folder();
    if (folder === null || this.pullHooks() !== null)
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
    if (folder === null || status === null)
      return Promise.reject(new StatusMissingException());
    const key: string = Resources.formatDiffKey(status.fingerprint, scope);
    const known: Promise<GitDiff> | undefined = this.diffs.get(key);
    if (known !== undefined)
      return known;
    const diff: Promise<GitDiff> = this.client.diffAsync(folder, new DiffScope(scope));
    this.diffs.set(key, diff);
    void diff.catch(() => this.diffs.delete(key));
    return diff;
  }

  public stageAsync(paths: readonly string[]): Promise<void> {
    return this.writeAsync((folder, basedOn) => this.client.stageAsync(folder, paths, basedOn));
  }

  public unstageAsync(paths: readonly string[]): Promise<void> {
    return this.writeAsync((folder, basedOn) => this.client.unstageAsync(folder, paths, basedOn));
  }

  public switchBranchAsync(name: string): Promise<void> {
    return this.writeAsync((folder, basedOn) => this.client.switchBranchAsync(folder, name, basedOn));
  }

  public createBranchAsync(name: string): Promise<void> {
    return this.writeAsync((folder, basedOn) => this.client.createBranchAsync(folder, name, basedOn));
  }

  public pushAsync(): Promise<void> {
    return this.writeAsync((folder, basedOn) => this.client.pushAsync(folder, basedOn));
  }

  public pullAsync(): Promise<void> {
    return this.writeAsync((folder, basedOn) => this.client.pullAsync(folder, basedOn));
  }

  public async followAgainAsync(): Promise<void> {
    const folder: string | null = this.folder();
    if (folder === null)
      return;
    this.watchFailure.set(null);
    await this.watchAsync(folder);
    await this.refreshAsync();
  }

  public async commitAsync(message: string): Promise<void> {
    const opened: number = this.opened;
    let committed: boolean = false;
    await this.writeAsync(async (folder, basedOn) => {
      await this.client.commitAsync(folder, message, basedOn);
      committed = true;
    });
    if (committed && opened === this.opened)
      this.message.set("");
  }

  private async openAsync(folder: string | null): Promise<void> {
    this.opened++;
    this.branchLoads++;
    this.branches.set(null);
    this.pullHooks.set(null);
    this.failure.set(null);
    this.watchFailure.set(null);
    this.message.set("");
    this.diffs.clear();
    if (folder !== null) {
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

  private async writeAsync(write: (folder: string, basedOn: string) => Promise<void>): Promise<void> {
    const folder: string | null = this.folder();
    const status: GitStatus | null = this.status();
    if (folder === null || status === null || this.busy())
      return;
    const opened: number = this.opened;
    this.busy.set(true);
    this.failure.set(null);
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
    this.show(failure === null ? GitViewPhase.NoFolder : GitViewPhase.FolderFailed, null);
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
