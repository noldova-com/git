/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */
import { lstat, open } from "node:fs/promises";
import path from "node:path";

import { FileState, LineCounts, StatusEntry, UntrustedSource } from "@noldova/git.protocol";

import { GitFailedException } from "../exceptions/git-failed.exception.ts";
import { UnreadableOutputException } from "../exceptions/unreadable-output.exception.ts";
import { GitArguments } from "../models/git-arguments.ts";
import { GitPath } from "../models/git-path.ts";
import { ProgramLimits } from "../models/program-limits.ts";
import { ProgramRun } from "../models/program-run.ts";
import { ReadBudget } from "../models/read-budget.ts";
import { Required } from "../models/required.ts";
import { Resources } from "../resources.ts";
import { FilePresence } from "./file-presence.ts";
import type { ProgramRunner } from "./program-runner.ts";

export class LineCountsReader {
  private static readonly LIMITS: ProgramLimits = new ProgramLimits(Resources.listOutputBytes, Resources.gitReadMilliseconds);
  private static readonly INDEX: GitArguments = new GitArguments([...Resources.numstatArguments, Resources.cachedOption, Resources.findRenamesOption]);
  private static readonly WORKTREE: GitArguments = new GitArguments([...Resources.numstatArguments, Resources.noRenamesOption]);
  private readonly runner: ProgramRunner;

  public constructor(runner: ProgramRunner) {
    this.runner = runner;
  }

  public async countAsync(top: string, entries: readonly StatusEntry[], filters: readonly string[], signal?: AbortSignal): Promise<StatusEntry[]> {
    const hasIndex = entries.some(t => LineCountsReader.isCounted(t.index));
    const hasWorktree = entries.some(t => LineCountsReader.isCounted(t.worktree));
    const [index, worktree] = await Promise.all([
      hasIndex ? this.readAsync(top, LineCountsReader.INDEX.withSettings(filters), signal) : new Map<string, LineCounts | null>(),
      hasWorktree ? this.readAsync(top, LineCountsReader.WORKTREE.withSettings(filters), signal) : new Map<string, LineCounts | null>()
    ]);
    const budget = new ReadBudget(Resources.lineCountTotalBytes);
    const counted: StatusEntry[] = [];
    for (const entry of entries) {
      const untracked = entry.worktree === FileState.Untracked;
      const worktreeCounts = untracked
        ? entry.pathBytes === undefined ? await LineCountsReader.countFileAsync(path.join(top, entry.path), budget) : null
        : LineCountsReader.isCounted(entry.worktree) ? worktree.get(entry.path) ?? null : null;
      const indexCounts = !untracked && LineCountsReader.isCounted(entry.index) ? index.get(entry.path) ?? null : null;
      counted.push(new StatusEntry(entry.path, entry.pathBytes, entry.originalPath, entry.originalPathBytes, entry.index, entry.worktree, entry.conflict,
        entry.submodule, indexCounts, worktreeCounts));
    }
    return counted;
  }

  public static parse(output: Buffer): Map<string, LineCounts | null> {
    const counts = new Map<string, LineCounts | null>();
    const records = LineCountsReader.split(output);
    for (let index = 0; index < records.length; index++) {
      const record = Required.at(records, index, Resources.numstatCommand, Resources.lineCountsPart);
      const first = record.indexOf(Resources.tab);
      const second = first < 0 ? -1 : record.indexOf(Resources.tab, first + 1);
      if (second < 0)
        throw LineCountsReader.unreadable();
      const isMoved = second + 1 === record.length;
      const target = isMoved ? records[index + 2] : record.subarray(second + 1);
      if (target === undefined)
        throw LineCountsReader.unreadable();
      if (isMoved)
        index += 2;
      counts.set(GitPath.fromBytes(target).text, LineCountsReader.toCounts(record.toString(Resources.latin1Encoding, 0, first), record.toString(Resources.latin1Encoding, first + 1, second)));
    }
    return counts;
  }

  private static isCounted(state: FileState): boolean {
    return state !== FileState.Unmodified && state !== FileState.Untracked && state !== FileState.Ignored;
  }

  private static toCounts(added: string, removed: string): LineCounts | null {
    if (added === Resources.binaryCount && removed === Resources.binaryCount)
      return null;
    if (!Resources.countPattern.test(added) || !Resources.countPattern.test(removed))
      throw LineCountsReader.unreadable();
    return new LineCounts(Number(added), Number(removed));
  }

  private static split(output: Buffer): Buffer[] {
    const records: Buffer[] = [];
    let start = 0;
    while (start < output.length) {
      const end = output.indexOf(Resources.nulByte, start);
      records.push(output.subarray(start, end < 0 ? output.length : end));
      start = end < 0 ? output.length : end + 1;
    }
    return records;
  }

  private static async countFileAsync(file: string, budget: ReadBudget): Promise<LineCounts | null> {
    try {
      if (!(await lstat(file)).isFile())
        return null;
      const content: Buffer | null = await LineCountsReader.readCappedAsync(file, Math.min(Resources.lineCountFileBytes, budget.remainingBytes));
      if (content === null)
        return null;
      budget.remainingBytes -= content.length;
      if (content.includes(Resources.nulByte))
        return null;
      let lines = 0;
      for (const byte of content)
        if (byte === Resources.lineEndByte)
          lines++;
      return new LineCounts(content.length > 0 && content[content.length - 1] !== Resources.lineEndByte ? lines + 1 : lines, 0);
    } catch (error) {
      if (FilePresence.isUnreadable(error))
        return null;
      throw error;
    }
  }

  /** The file's bytes, opened once and read only up to the size its open handle had, or null when that size passes the limit, so a file that grows after the check never reads past the budget. */
  private static async readCappedAsync(file: string, limit: number): Promise<Buffer | null> {
    const handle = await open(file, "r");
    try {
      const { size } = await handle.stat();
      if (size > limit)
        return null;
      const buffer = Buffer.alloc(size);
      const { bytesRead } = await handle.read(buffer, 0, size, 0);
      return buffer.subarray(0, bytesRead);
    } finally {
      await handle.close();
    }
  }

  private async readAsync(top: string, gitArguments: GitArguments, signal?: AbortSignal): Promise<Map<string, LineCounts | null>> {
    const result = await this.runner.runAsync(ProgramRun.readGit(gitArguments, top, LineCountsReader.LIMITS, signal));
    if (result.exit.code !== 0)
      throw new GitFailedException(Resources.numstatCommand, { text: result.errors.toString(Resources.utf8Encoding), source: UntrustedSource.Repository });
    return result.isTruncated ? new Map() : LineCountsReader.parse(result.output);
  }

  private static unreadable(): UnreadableOutputException {
    return new UnreadableOutputException(Resources.numstatCommand, Resources.lineCountsPart);
  }
}
