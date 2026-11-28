/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { DiffFile, type DiffScope, DiffScopeKind, DiffTotals, FileChange, GitDiff, UntrustedSource } from "@noldova/git.protocol";

import { GitFailedException } from "../exceptions/git-failed.exception.ts";
import type { GitFailureException } from "../exceptions/git-failure.exception.ts";
import { UnreadableOutputException } from "../exceptions/unreadable-output.exception.ts";
import { UnsafeRepositoryException } from "../exceptions/unsafe-repository.exception.ts";
import { DiffBudget } from "../models/diff-budget.ts";
import { GitArguments } from "../models/git-arguments.ts";
import { GitPath } from "../models/git-path.ts";
import { ParsedDiff } from "../models/parsed-diff.ts";
import { ProgramLimits } from "../models/program-limits.ts";
import type { ProgramResult } from "../models/program-result.ts";
import { ProgramRun } from "../models/program-run.ts";
import { Resources } from "../resources.ts";
import { DiffParser } from "./diff.parser.ts";
import { FilterOptionsReader } from "./filter-options.reader.ts";
import { LineCountsReader } from "./line-counts.reader.ts";
import { LogReader } from "./log.reader.ts";
import type { ProgramRunner } from "./program-runner.ts";

export class DiffReader {
  private static readonly LIMITS: ProgramLimits = new ProgramLimits(Resources.diffOutputBytes, Resources.gitReadMilliseconds);
  private static readonly LIST_LIMITS: ProgramLimits = new ProgramLimits(Resources.listOutputBytes, Resources.gitReadMilliseconds);
  private static readonly UNTRACKED: GitArguments = new GitArguments(Resources.untrackedDiffArguments);
  private static readonly LIST: GitArguments = new GitArguments(Resources.untrackedListArguments);
  private readonly runner: ProgramRunner;
  private readonly filters: FilterOptionsReader;

  public constructor(runner: ProgramRunner) {
    this.runner = runner;
    this.filters = new FilterOptionsReader(runner);
  }

  public async readAsync(worktree: string, scope: DiffScope, paths: readonly string[], signal?: AbortSignal): Promise<GitDiff> {
    const budget = new DiffBudget(Resources.diffFileBytes, Resources.diffTotalBytes);
    const options = scope.kind === DiffScopeKind.Staged ? [...Resources.trackedDiffArguments, Resources.cachedOption] : Resources.trackedDiffArguments;
    const revisions = Object.isUndefined(scope.from) || Object.isUndefined(scope.to) ? [] : [scope.from, scope.to];
    const filters = await this.filters.readAsync(worktree, signal);
    const result = await this.runAsync(new GitArguments([...filters, ...options], revisions, paths), worktree, DiffReader.LIMITS, Resources.diffCommand, signal);
    budget.addParsed(DiffParser.parse(result.output, result.isTruncated));
    if (scope.kind === DiffScopeKind.Worktree)
      await this.addUntrackedAsync(budget, worktree, paths, filters, signal);
    const diff: GitDiff = budget.toDiff();
    if (!diff.truncated || scope.kind === DiffScopeKind.Worktree)
      return diff;
    return new GitDiff(diff.files, diff.totalBytes, diff.omittedFiles, true, await this.countFilteredAsync(worktree, scope, paths, filters, signal));
  }

  public async countAsync(worktree: string, scope: DiffScope, signal?: AbortSignal): Promise<DiffTotals> {
    const totals: DiffTotals | null = await this.countFilteredAsync(worktree, scope, [], await this.filters.readAsync(worktree, signal), signal);
    if (Object.isNull(totals))
      throw new UnreadableOutputException(Resources.numstatCommand, Resources.lineCountsPart);
    return totals;
  }

  private async countFilteredAsync(worktree: string, scope: DiffScope, paths: readonly string[], filters: readonly string[], signal?: AbortSignal)
    : Promise<DiffTotals | null> {
    const options = scope.kind === DiffScopeKind.Staged ? [...Resources.totalsDiffArguments, Resources.cachedOption] : Resources.totalsDiffArguments;
    const revisions = Object.isUndefined(scope.from) || Object.isUndefined(scope.to) ? [] : [scope.from, scope.to];
    const result = await this.runAsync(new GitArguments([...filters, ...options], revisions, paths), worktree, DiffReader.LIST_LIMITS, Resources.numstatCommand, signal);
    if (result.isTruncated)
      return null;
    const counts = [...LineCountsReader.parse(result.output).values()];
    return new DiffTotals(counts.length, counts.reduce((sum, t) => sum + (t?.added ?? 0), 0), counts.reduce((sum, t) => sum + (t?.removed ?? 0), 0));
  }

  private async addUntrackedAsync(budget: DiffBudget, worktree: string, paths: readonly string[], filters: readonly string[], signal?: AbortSignal): Promise<void> {
    const listed = await this.runAsync(DiffReader.LIST.withPaths(paths), worktree, DiffReader.LIST_LIMITS, Resources.lsFilesCommand, signal);
    const names = DiffReader.split(listed.output);
    for (const [index, name] of names.entries()) {
      if (budget.isFull || index === Resources.untrackedFilesLimit) {
        budget.omit(names.length - index);
        return;
      }
      budget.addParsed(await this.readUntrackedAsync(worktree, name, filters, signal));
    }
  }

  private async readUntrackedAsync(worktree: string, name: Buffer, filters: readonly string[], signal?: AbortSignal): Promise<ParsedDiff> {
    const path = GitPath.fromBytes(name);
    const unread = new ParsedDiff([new DiffFile(path.text, path.bytes, path.text, path.bytes, FileChange.Added, null, null, false, null, [], true)], 0, false);
    if (!Object.isUndefined(path.bytes) || name.at(-1) === Resources.slashByte)
      return unread;
    const gitArguments = DiffReader.UNTRACKED.withSettings(filters).withPaths([Resources.nullDevice, path.text]);
    const result = await this.runner.runAsync(ProgramRun.readGit(gitArguments, worktree, DiffReader.LIMITS, signal));
    if (result.exit.code === Resources.gitFatalExitCode)
      return unread;
    if (result.exit.code !== 0 && result.exit.code !== Resources.differentExitCode)
      throw DiffReader.failure(Resources.diffCommand, result);
    if (result.output.length === 0)
      return unread;
    return DiffParser.parse(result.output, result.isTruncated);
  }

  private async runAsync(
    gitArguments: GitArguments,
    worktree: string,
    limits: ProgramLimits,
    command: string,
    signal?: AbortSignal): Promise<ProgramResult> {
    const result = await this.runner.runAsync(ProgramRun.readGit(gitArguments, worktree, limits, signal));
    if (result.exit.code !== 0)
      throw DiffReader.failure(command, result);
    return result;
  }

  private static failure(command: string, result: ProgramResult): GitFailureException {
    const output = { text: result.errors.toString(Resources.utf8Encoding), source: UntrustedSource.Repository };
    const unsafe = Resources.unsafeRepositoryPattern.exec(output.text)?.groups?.[Resources.folderGroup];
    if (!Object.isUndefined(unsafe))
      return new UnsafeRepositoryException(LogReader.toLine(unsafe), output);
    return new GitFailedException(command, output);
  }

  private static split(output: Buffer): Buffer[] {
    const names: Buffer[] = [];
    let start = 0;
    for (let end = output.indexOf(Resources.nulByte); end >= 0; end = output.indexOf(Resources.nulByte, start)) {
      names.push(output.subarray(start, end));
      start = end + 1;
    }
    return names;
  }
}
