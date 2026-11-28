/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { randomBytes } from "node:crypto";
import { realpath } from "node:fs/promises";
import path from "node:path";

import "@noldova/context.core";
import type { IRuntimePartContext } from "@noldova/desktop.runtime";
import { type DiffScope, type GitDiff, type GitStatus, UntrustedSource, WorktreeRecord } from "@noldova/git.protocol";

import { BaseInvalidException } from "../exceptions/base-invalid.exception.ts";
import { BranchExistsException } from "../exceptions/branch-exists.exception.ts";
import { BranchInvalidException } from "../exceptions/branch-invalid.exception.ts";
import { BranchKeptException } from "../exceptions/branch-kept.exception.ts";
import { BranchUnmergedException } from "../exceptions/branch-unmerged.exception.ts";
import { ChangesTooLargeException } from "../exceptions/changes-too-large.exception.ts";
import { GitFailedException } from "../exceptions/git-failed.exception.ts";
import { KeyInOtherRepositoryException } from "../exceptions/key-in-other-repository.exception.ts";
import { LockedElsewhereException } from "../exceptions/locked-elsewhere.exception.ts";
import { StaleRemovalException } from "../exceptions/stale-removal.exception.ts";
import { WorktreeBranchCheckedOutException } from "../exceptions/worktree-branch-checked-out.exception.ts";
import { WorktreeListTooLargeException } from "../exceptions/worktree-list-too-large.exception.ts";
import { WorktreeMissingException } from "../exceptions/worktree-missing.exception.ts";
import type { ICallContext } from "../interfaces/i-call-context.ts";
import type { ICreateWorktreeOptions } from "../interfaces/i-create-worktree-options.ts";
import type { IRemoveWorktreeOptions } from "../interfaces/i-remove-worktree-options.ts";
import type { IUntrustedText } from "../interfaces/i-untrusted-text.ts";
import { CallProgress } from "../models/call-progress.ts";
import { ChangedPaths } from "../models/changed-paths.ts";
import { GitArguments } from "../models/git-arguments.ts";
import { ProgramLimits } from "../models/program-limits.ts";
import type { ProgramResult } from "../models/program-result.ts";
import { ProgramRun } from "../models/program-run.ts";
import { RemoveWorktreeRequest } from "../models/remove-worktree-request.ts";
import type { RepositoryFolders } from "../models/repository-folders.ts";
import type { WorktreeEntry } from "../models/worktree-entry.ts";
import { Resources } from "../resources.ts";
import { ChangedPathsParser } from "./changed-paths.parser.ts";
import { ChangesDigest } from "./changes-digest.ts";
import { DiffReader } from "./diff.reader.ts";
import { FilterOptionsReader } from "./filter-options.reader.ts";
import { FilePresence } from "./file-presence.ts";
import { GitVersionReader } from "./git-version.reader.ts";
import { KeyQueue } from "./key-queue.ts";
import type { ProgramRunner } from "./program-runner.ts";
import { RepositoryReader } from "./repository.reader.ts";
import { StatusReader } from "./status.reader.ts";
import { WorktreeListParser } from "./worktree-list.parser.ts";
import { WorktreeTable } from "./worktree-table.ts";

export class WorktreeService {
  private static readonly READ_LIMITS: ProgramLimits = new ProgramLimits(Resources.listOutputBytes, Resources.gitReadMilliseconds);
  private static readonly WRITE_LIMITS: ProgramLimits = new ProgramLimits(Resources.writeOutputBytes, Resources.checkoutMilliseconds);
  private static readonly ADD_LIMITS: ProgramLimits = new ProgramLimits(Resources.writeOutputBytes, Resources.worktreeAddMilliseconds);
  private static readonly LIST: GitArguments = new GitArguments(Resources.worktreeListArguments);
  private static readonly STATUS: GitArguments = new GitArguments(Resources.worktreeStatusArguments);
  private static readonly READ_COMMIT: GitArguments = new GitArguments(Resources.readCommitArguments);
  private static readonly CHECK_BRANCH: GitArguments = new GitArguments(Resources.checkRefFormatArguments);
  private static readonly SHOW_BRANCH: GitArguments = new GitArguments(Resources.showRefArguments);
  private static readonly ADD: GitArguments = new GitArguments(Resources.worktreeAddArguments);
  private static readonly UNLOCK: GitArguments = new GitArguments(Resources.worktreeUnlockArguments);
  private static readonly REMOVE: GitArguments = new GitArguments(Resources.worktreeRemoveArguments);
  private static readonly DELETE_BRANCH: GitArguments = new GitArguments(Resources.deleteBranchArguments);
  private static readonly READ_UPSTREAM: GitArguments = new GitArguments(Resources.readUpstreamArguments);
  private static readonly IS_MERGED: GitArguments = new GitArguments(Resources.isAncestorArguments);
  private readonly context: Pick<IRuntimePartContext, "database" | "log" | "getWorkFolderAsync">;
  private readonly runner: ProgramRunner;
  private readonly repositories: RepositoryReader;
  private readonly table: WorktreeTable;
  private readonly statuses: StatusReader;
  private readonly diffs: DiffReader;
  private readonly filters: FilterOptionsReader;
  private readonly digest: ChangesDigest = new ChangesDigest(Resources.changesDigestBytes);
  private readonly calls: KeyQueue = new KeyQueue();

  public constructor(context: Pick<IRuntimePartContext, "database" | "log" | "getWorkFolderAsync">, runner: ProgramRunner) {
    this.context = context;
    this.runner = runner;
    this.repositories = new RepositoryReader(runner, new GitVersionReader(runner));
    this.table = new WorktreeTable(context.database);
    this.statuses = new StatusReader(runner);
    this.diffs = new DiffReader(runner);
    this.filters = new FilterOptionsReader(runner);
  }

  public async createWorktreeAsync(key: string, options: ICreateWorktreeOptions): Promise<WorktreeRecord> {
    options.signal?.throwIfAborted();
    const progress = new CallProgress(options.signal ?? null);
    return await this.finishAsync(this.calls.runAsync(key, () => this.createAsync(key, options, progress)), progress, options.signal);
  }

  public async findWorktreeAsync(key: string): Promise<WorktreeRecord | null> {
    return await this.calls.runAsync(key, () => this.findAsync(key, new CallProgress()));
  }

  public async removeWorktreeAsync(key: string, options: IRemoveWorktreeOptions): Promise<void> {
    options.context.signal?.throwIfAborted();
    const progress = new CallProgress(options.context.signal ?? null);
    await this.finishAsync(this.calls.runAsync(key, () => this.removeAsync(key, options, progress)), progress, options.context.signal);
  }

  public async statusAsync(key: string, signal?: AbortSignal): Promise<GitStatus> {
    return await this.statuses.readAsync(await this.repositories.readAsync((await this.requireAsync(key)).path), signal);
  }

  public async diffAsync(key: string, scope: DiffScope, paths: readonly string[] = [], signal?: AbortSignal): Promise<GitDiff> {
    return await this.diffs.readAsync((await this.requireAsync(key)).path, scope, paths, signal);
  }

  public async reconcileAsync(): Promise<void> {
    const repositories = new Set<string>();
    for (const { record } of this.table.readAll()) {
      repositories.add(record.repository);
      try {
        await this.calls.runAsync(record.key, () => this.findAsync(record.key, new CallProgress()));
      } catch (error) {
        this.context.log.write(Resources.formatReconcileFailed(record.path, String(error)));
      }
    }
    for (const repository of repositories)
      try {
        const entries = await this.listAsync(await this.repositories.readAsync(repository));
        const own = this.table.readAll().map(t => t.record.path);
        for (const entry of entries.slice(1).filter(t => !own.some(folder => t.isAt(folder))))
          this.context.log.write(Resources.formatNotOurs(entry.path));
      } catch (error) {
        this.context.log.write(Resources.formatReconcileFailed(repository, String(error)));
      }
  }

  private async createAsync(key: string, options: ICreateWorktreeOptions, progress: CallProgress): Promise<WorktreeRecord> {
    const folders = await this.repositories.readAsync(options.repository);
    const existing = await this.findAsync(key, progress);
    if (!Object.isNull(existing)) {
      if (existing.repository !== folders.top)
        throw new KeyInOtherRepositoryException();
      return existing;
    }
    const base = await this.readCommitAsync(folders, options.base ?? Resources.headRevision);
    const id = randomBytes(Resources.worktreeIdBytes).toString(Resources.hexEncoding);
    if (!Object.isUndefined(options.branch))
      await this.requireNewBranchAsync(folders, options.branch);
    const branch = options.branch ?? Resources.formatBranch(id);
    const folder = path.join(await realpath(await this.context.getWorkFolderAsync()), id);
    const record = new WorktreeRecord(key, folders.top, folder, branch, base);
    progress.startWriting();
    this.table.insertPending(record);
    const add = new GitArguments([...WorktreeService.ADD.values, Resources.newBranchOption, branch]).withRevisions([folder, base]);
    const result = await this.writeAsync(folders, add, WorktreeService.ADD_LIMITS);
    if (result.exit.code !== 0) {
      this.table.delete(key);
      throw this.failure(add, result);
    }
    this.table.markReady(key);
    return record;
  }

  private async requireAsync(key: string): Promise<WorktreeRecord> {
    const record = await this.findWorktreeAsync(key);
    if (Object.isNull(record))
      throw new WorktreeMissingException();
    return record;
  }

  private async findAsync(key: string, progress: CallProgress): Promise<WorktreeRecord | null> {
    const stored = this.table.find(key);
    if (Object.isNull(stored))
      return null;
    const folders = await this.repositories.readAsync(stored.record.repository);
    const entry = (await this.listAsync(folders)).find(t => t.isAt(stored.record.path));
    if (!stored.isPending && await this.isPresentAsync(stored.record, entry))
      return stored.record;
    await this.clearAsync(stored.record, folders, entry, progress);
    this.context.log.write(Resources.formatCleared(stored.record.path));
    return null;
  }

  private async removeAsync(key: string, options: IRemoveWorktreeOptions, progress: CallProgress): Promise<void> {
    const stored = this.table.find(key);
    if (Object.isNull(stored))
      return;
    const { record } = stored;
    const folders = await this.repositories.readAsync(record.repository);
    const entry = (await this.listAsync(folders)).find(t => t.isAt(record.path));
    if (!Object.isUndefined(entry) && entry.isLockedElsewhere(Resources.lockReason))
      throw new LockedElsewhereException(record.path);
    if (!stored.isPending && await this.isPresentAsync(record, entry))
      await this.askIfChangedAsync(record, options, progress);
    await this.clearAsync(record, folders, entry, progress);
    if (options.keepBranch === false)
      await this.deleteBranchAsync(folders, record.branch);
  }

  private async askIfChangedAsync(record: WorktreeRecord, { context, gate }: IRemoveWorktreeOptions, progress: CallProgress): Promise<void> {
    const request = await this.readRequestAsync(record, context);
    if (request.changes.isEmpty)
      return;
    await progress.askAsync(() => gate.requestAsync(request, context.signal));
    const current = await this.readRequestAsync(record, context);
    if (!request.isCurrent(current.head, current.changes))
      throw new StaleRemovalException();
  }

  private async readRequestAsync(record: WorktreeRecord, context: ICallContext): Promise<RemoveWorktreeRequest> {
    const headArguments = WorktreeService.READ_COMMIT.withRevisions([Resources.headRevision]);
    const head = await this.readAsync(record.path, headArguments);
    this.requireSuccess(headArguments, head);
    const filters = await this.filters.readAsync(record.path, context.signal);
    const status = await this.readAsync(record.path, WorktreeService.STATUS.withSettings(filters));
    this.requireSuccess(WorktreeService.STATUS, status);
    if (status.isTruncated)
      throw new ChangesTooLargeException();
    const paths = ChangedPathsParser.parse(status.output);
    const digest = await this.digest.readAsync(record.path, status.output, paths);
    const listed = paths.slice(0, Resources.statusEntriesLimit).map(t => t.toString(Resources.utf8Encoding));
    return new RemoveWorktreeRequest(context, record, head.output.toString(Resources.utf8Encoding).trim(), new ChangedPaths(listed, paths.length > listed.length, digest));
  }

  private async clearAsync(record: WorktreeRecord, folders: RepositoryFolders, entry: WorktreeEntry | undefined, progress: CallProgress): Promise<void> {
    progress.startWriting();
    if (!Object.isUndefined(entry) && !entry.isLockedElsewhere(Resources.lockReason)) {
      if (entry.isLocked)
        await this.writeOrThrowAsync(folders, WorktreeService.UNLOCK.withRevisions([record.path]));
      await this.writeOrThrowAsync(folders, WorktreeService.REMOVE.withRevisions([record.path]));
    }
    this.table.delete(record.key);
  }

  private async deleteBranchAsync(folders: RepositoryFolders, branch: string): Promise<void> {
    if (!await this.hasBranchAsync(folders, branch))
      return;
    const result = await this.writeAsync(folders, WorktreeService.DELETE_BRANCH.withRevisions([branch]), WorktreeService.WRITE_LIMITS);
    if (result.exit.code === 0)
      return;
    const output = WorktreeService.untrusted(result);
    if (await this.isMergedAsync(folders, branch))
      throw new BranchKeptException(branch, output);
    throw new BranchUnmergedException(branch, output);
  }

  private async isMergedAsync(folders: RepositoryFolders, branch: string): Promise<boolean> {
    const reference = Resources.formatBranchRef(branch);
    const upstreamArguments = WorktreeService.READ_UPSTREAM.withRevisions([reference]);
    const upstream = await this.readAsync(folders.top, upstreamArguments);
    this.requireSuccess(upstreamArguments, upstream);
    const name = upstream.output.toString(Resources.utf8Encoding).trim();
    const isUpstreamPresent = name.length > 0 && (await this.readAsync(folders.top, WorktreeService.READ_COMMIT.withRevisions([Resources.formatPeeledCommit(name)]))).exit.code === 0;
    const merged = await this.readAsync(folders.top, WorktreeService.IS_MERGED.withRevisions([reference, isUpstreamPresent ? name : Resources.headRevision]));
    if (merged.exit.code !== 0 && merged.exit.code !== Resources.notAncestorExitCode)
      throw this.failure(WorktreeService.IS_MERGED, merged);
    return merged.exit.code === 0;
  }

  private async hasBranchAsync(folders: RepositoryFolders, branch: string): Promise<boolean> {
    const reference = Resources.formatBranchRef(branch);
    const result = await this.readAsync(folders.top, new GitArguments([...WorktreeService.SHOW_BRANCH.values, reference]));
    if (result.exit.code !== 0 && result.exit.code !== Resources.refMissingExitCode)
      throw this.failure(WorktreeService.SHOW_BRANCH, result);
    return result.exit.code === 0;
  }

  private async readCommitAsync(folders: RepositoryFolders, revision: string): Promise<string> {
    const result = await this.readAsync(folders.top, WorktreeService.READ_COMMIT.withRevisions([Resources.formatPeeledCommit(revision)]));
    if (result.exit.code !== 0)
      throw new BaseInvalidException(revision);
    return result.output.toString(Resources.utf8Encoding).trim();
  }

  private async requireNewBranchAsync(folders: RepositoryFolders, branch: string): Promise<void> {
    const reference = Resources.formatBranchRef(branch);
    if ((await this.readAsync(folders.top, new GitArguments([...WorktreeService.CHECK_BRANCH.values, reference]))).exit.code !== 0)
      throw new BranchInvalidException(branch);
    if (!await this.hasBranchAsync(folders, branch))
      return;
    if ((await this.listAsync(folders)).some(t => t.branch === branch))
      throw new WorktreeBranchCheckedOutException(branch);
    throw new BranchExistsException(branch);
  }

  private async listAsync(folders: RepositoryFolders): Promise<WorktreeEntry[]> {
    const result = await this.readAsync(folders.top, WorktreeService.LIST);
    this.requireSuccess(WorktreeService.LIST, result);
    if (result.isTruncated)
      throw new WorktreeListTooLargeException();
    return WorktreeListParser.parse(result.output);
  }

  private async isPresentAsync(record: WorktreeRecord, entry: WorktreeEntry | undefined): Promise<boolean> {
    if (Object.isUndefined(entry) || entry.isPrunable)
      return false;
    return await FilePresence.existsAsync(record.path);
  }

  private async readAsync(folder: string, gitArguments: GitArguments): Promise<ProgramResult> {
    return await this.runner.runAsync(ProgramRun.readGit(gitArguments, folder, WorktreeService.READ_LIMITS));
  }

  private async writeAsync(folders: RepositoryFolders, gitArguments: GitArguments, limits: ProgramLimits): Promise<ProgramResult> {
    return await this.runner.runAsync(ProgramRun.writeGit(gitArguments, folders.top, folders.gitFolder, folders.commonGitFolder, limits));
  }

  private async writeOrThrowAsync(folders: RepositoryFolders, gitArguments: GitArguments): Promise<void> {
    this.requireSuccess(gitArguments, await this.writeAsync(folders, gitArguments, WorktreeService.WRITE_LIMITS));
  }

  private requireSuccess(gitArguments: GitArguments, result: ProgramResult): void {
    if (result.exit.code !== 0)
      throw this.failure(gitArguments, result);
  }

  private failure(gitArguments: GitArguments, result: ProgramResult): GitFailedException {
    return new GitFailedException(Resources.formatGitCommand(gitArguments.values), WorktreeService.untrusted(result));
  }

  private static untrusted(result: ProgramResult): IUntrustedText {
    return { text: result.errors.toString(Resources.utf8Encoding), source: UntrustedSource.Repository };
  }

  private async finishAsync<T>(work: Promise<T>, progress: CallProgress, signal?: AbortSignal): Promise<T> {
    if (Object.isUndefined(signal))
      return await work;
    const cancelled = Promise.withResolvers<never>();
    const cancel = (): void => cancelled.reject(progress.cancelFailure(signal.reason));
    signal.addEventListener("abort", cancel, { once: true });
    try {
      return await Promise.race([work, cancelled.promise]);
    } finally {
      signal.removeEventListener("abort", cancel);
    }
  }
}
