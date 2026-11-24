/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { lstat, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { GitConflict, type GitOperation, OperationKind, UntrustedSource } from "@noldova/git.protocol";

import { ConflictGoneException } from "../exceptions/conflict-gone.exception.ts";
import { GitFailedException } from "../exceptions/git-failed.exception.ts";
import { ConflictMarkers } from "../models/conflict-markers.ts";
import { GitArguments } from "../models/git-arguments.ts";
import { ProgramLimits } from "../models/program-limits.ts";
import type { ProgramResult } from "../models/program-result.ts";
import { ProgramRun } from "../models/program-run.ts";
import type { RepositoryFolders } from "../models/repository-folders.ts";
import { Resources } from "../resources.ts";
import { FilePresence } from "./file-presence.ts";
import { OperationReader } from "./operation.reader.ts";
import type { ProgramRunner } from "./program-runner.ts";

/** One unmerged stage of a file: its mode and blob. */
interface IStage {
  readonly mode: string;
  readonly id: string;
}

/**
 * Reads a conflicted file for the conflict screen: its base, ours and theirs stages, git's zdiff3 merge of them, and the names of the two sides.
 * It only reads: the merge runs over copies in a private temporary folder, never over the worktree or the index.
 */
export class ConflictReader {
  private static readonly LIST_LIMITS: ProgramLimits = new ProgramLimits(Resources.lineOutputBytes, Resources.gitReadMilliseconds);
  private static readonly BLOB_LIMITS: ProgramLimits = new ProgramLimits(Resources.conflictTextBytes, Resources.gitReadMilliseconds);
  private static readonly MERGE_LIMITS: ProgramLimits = new ProgramLimits(Resources.mergedTextBytes, Resources.gitReadMilliseconds);
  private static readonly HEAD: GitArguments = new GitArguments(Resources.headCommitAndNameArguments);
  private static readonly BRANCH: GitArguments = new GitArguments(Resources.shortBranchArguments);

  private readonly runner: ProgramRunner;

  public constructor(runner: ProgramRunner) {
    this.runner = runner;
  }

  public async readAsync(folders: RepositoryFolders, file: string, signal?: AbortSignal): Promise<GitConflict> {
    const stages = await this.stagesAsync(folders.top, file, signal);
    const kind = Resources.stageKinds.get(stages.flatMap((stage, index) => stage === null ? [] : [String(index + 1)]).join(""));
    if (kind === undefined)
      throw new ConflictGoneException();
    const operation = await OperationReader.readAsync(folders.gitFolder);
    // Each git run costs a process start, which a busy machine stretches, so the reads that don't need each other run together.
    const [baseText, oursText, theirsText, [oursLabel, theirsLabel, oursCommit, theirsCommit]] = await Promise.all([this.textAsync(folders.top, stages[0], signal),
      this.textAsync(folders.top, stages[1], signal), this.textAsync(folders.top, stages[2], signal), this.labelsAsync(folders, operation, signal)]);
    const texts: readonly [string | null, string | null, string | null] = [baseText, oursText, theirsText];
    const binary = stages.some((stage, index) => stage !== null && texts[index] === null);
    const [base, ours, theirs] = binary ? [null, null, null] : texts;
    let merged: string | null = null;
    let reused = false;
    if (ours !== null && theirs !== null) {
      const worktree = await ConflictReader.worktreeTextAsync(path.join(folders.top, file));
      reused = worktree !== null && !ConflictMarkers.has(worktree);
      merged = worktree !== null && reused ? worktree : await this.mergeAsync(folders.top, [base, ours, theirs], [oursLabel, theirsLabel], signal);
    }
    return new GitConflict(file, kind, operation?.kind ?? null, base, ours, theirs, merged, oursLabel, theirsLabel, oursCommit, theirsCommit, binary,
      reused);
  }

  private async stagesAsync(top: string, file: string, signal?: AbortSignal): Promise<[IStage | null, IStage | null, IStage | null]> {
    const result = await this.runGitAsync(top, new GitArguments(Resources.unmergedArguments).withPaths([file]), ConflictReader.LIST_LIMITS,
      Resources.lsFilesCommand, signal);
    const stages: [IStage | null, IStage | null, IStage | null] = [null, null, null];
    for (const record of result.output.toString(Resources.utf8Encoding).split(Resources.nulCharacter)) {
      const match = Resources.unmergedRecordPattern.exec(record);
      if (match?.[1] !== undefined && match[2] !== undefined && match[3] !== undefined && match[4] === file)
        stages[Number(match[3]) - 1] = { mode: match[1], id: match[2] };
    }
    return stages;
  }

  /** The stage's text, or `null` when it is missing, isn't a regular file, is too large, holds a NUL byte or isn't UTF-8. */
  private async textAsync(top: string, stage: IStage | null, signal?: AbortSignal): Promise<string | null> {
    if (stage === null || !Resources.textModes.includes(stage.mode))
      return null;
    const result = await this.runner.runAsync(ProgramRun.readGit(new GitArguments(Resources.blobArguments).withRevisions([stage.id]), top,
      ConflictReader.BLOB_LIMITS, signal));
    if (result.exit.code !== 0 && !result.isTruncated)
      throw new GitFailedException(Resources.catFileCommand, { text: result.errors.toString(Resources.utf8Encoding), source: UntrustedSource.Repository });
    return result.isTruncated ? null : ConflictReader.decode(result.output);
  }

  private async mergeAsync(top: string, texts: readonly [string | null, string, string], labels: readonly [string, string], signal?: AbortSignal): Promise<string> {
    const folder = await mkdtemp(path.join(tmpdir(), Resources.conflictTemporaryPrefix));
    try {
      const [base, ours, theirs] = [path.join(folder, Resources.baseFileName), path.join(folder, Resources.oursFileName), path.join(folder, Resources.theirsFileName)];
      await Promise.all([writeFile(base, texts[0] ?? "", Resources.utf8Encoding), writeFile(ours, texts[1], Resources.utf8Encoding),
        writeFile(theirs, texts[2], Resources.utf8Encoding)]);
      const gitArguments = new GitArguments([...Resources.mergeFileArguments, Resources.labelOption, labels[0], Resources.labelOption, Resources.conflictBaseLabel,
        Resources.labelOption, labels[1]], [], [ours, base, theirs]);
      const result = await this.runner.runAsync(ProgramRun.readGit(gitArguments, top, ConflictReader.MERGE_LIMITS, signal));
      if (result.exit.code === null || result.exit.code >= Resources.gitFatalExitCode || result.isTruncated)
        throw new GitFailedException(Resources.mergeFileCommand, { text: result.errors.toString(Resources.utf8Encoding), source: UntrustedSource.Repository });
      return result.output.toString(Resources.utf8Encoding);
    } finally {
      await rm(folder, { recursive: true, force: true });
    }
  }

  /**
   * The names shown over ours and theirs, then their commits; a rebase replays your commits onto another branch, so its ours is that branch
   * and its theirs your commit. Ours is always the commit at `HEAD`; theirs is the operation's head file's.
   */
  private async labelsAsync(folders: RepositoryFolders, operation: GitOperation | null, signal?: AbortSignal):
    Promise<[string, string, string | null, string | null]> {
    if (operation?.kind === OperationKind.Rebase) {
      let onto: string | null = null;
      for (const folder of Resources.rebaseFolders)
        onto ??= await OperationReader.readLineAsync(path.join(folders.gitFolder, folder, Resources.ontoFile));
      const replayed = await OperationReader.readLineAsync(path.join(folders.gitFolder, Resources.rebaseHeadFile));
      const [ontoName, [, head]] = await Promise.all([onto === null ? null : this.nameAsync(folders.top, onto, signal), this.headAsync(folders.top, signal)]);
      return [
        ontoName === null ? Resources.currentLabel : Resources.formatOntoLabel(ontoName),
        replayed === null ? Resources.incomingLabel : Resources.formatYourCommitLabel(replayed.slice(0, Resources.shortIdLength)),
        head,
        ConflictReader.commitOf(replayed)
      ];
    }
    const from = operation?.from ?? null;
    if (operation === null || from === null) {
      const [branch, head] = await this.headAsync(folders.top, signal);
      return [branch, Resources.incomingLabel, head, null];
    }
    if (operation.kind === OperationKind.Merge) {
      const [[branch, head], name] = await Promise.all([this.headAsync(folders.top, signal), this.nameAsync(folders.top, from, signal)]);
      return [branch, name, head, ConflictReader.commitOf(from)];
    }
    const shortId = from.slice(0, Resources.shortIdLength);
    const [branch, head] = await this.headAsync(folders.top, signal);
    return [branch, operation.kind === OperationKind.Revert ? Resources.formatRevertedLabel(shortId) : Resources.formatPickedLabel(shortId), head,
      ConflictReader.commitOf(from)];
  }

  /**
   * The branch at `HEAD`, or `HEAD` when it is detached, and the commit at `HEAD`: one run, since each run costs a process start. When `HEAD`'s branch
   * has no commit yet that run fails, so only then a second run reads the branch's name, and the commit is `null`.
   */
  private async headAsync(top: string, signal?: AbortSignal): Promise<[string, string | null]> {
    const result = await this.runner.runAsync(ProgramRun.readGit(ConflictReader.HEAD, top, ConflictReader.LIST_LIMITS, signal));
    const lines: readonly string[] = result.exit.code === 0 ? result.output.toString(Resources.utf8Encoding).trim().split(Resources.linePattern) : [];
    return [lines.at(1) ?? await this.branchAsync(top, signal), ConflictReader.commitOf(lines.at(0) ?? null)];
  }

  /** The branch `HEAD` names, or `HEAD` when it is detached. */
  private async branchAsync(top: string, signal?: AbortSignal): Promise<string> {
    const result = await this.runner.runAsync(ProgramRun.readGit(ConflictReader.BRANCH, top, ConflictReader.LIST_LIMITS, signal));
    const branch = result.output.toString(Resources.utf8Encoding).trim();
    return result.exit.code === 0 && branch.length > 0 ? branch : Resources.headLabel;
  }

  /** A side's commit from a head file's line or git's output, or `null` when there is none or it isn't a full object id. */
  private static commitOf(line: string | null): string | null {
    return line !== null && Resources.objectIdPattern.test(line) ? line : null;
  }

  /** A branch, local or remote, at the commit, or else its short id. */
  private async nameAsync(top: string, id: string, signal?: AbortSignal): Promise<string> {
    if (!Resources.objectIdPattern.test(id))
      return Resources.incomingLabel;
    const gitArguments = new GitArguments([...Resources.pointingRefArguments, Resources.formatPointsAt(id), ...Resources.pointingRefPatterns]);
    const result = await this.runGitAsync(top, gitArguments, ConflictReader.LIST_LIMITS, Resources.forEachRefCommand, signal);
    const [name = ""] = result.output.toString(Resources.utf8Encoding).split(Resources.linePattern);
    return name.trim().length > 0 ? name.trim() : id.slice(0, Resources.shortIdLength);
  }

  private async runGitAsync(top: string, gitArguments: GitArguments, limits: ProgramLimits, command: string, signal?: AbortSignal): Promise<ProgramResult> {
    const result = await this.runner.runAsync(ProgramRun.readGit(gitArguments, top, limits, signal));
    if (result.exit.code !== 0 || result.isTruncated)
      throw new GitFailedException(command, { text: result.errors.toString(Resources.utf8Encoding), source: UntrustedSource.Repository });
    return result;
  }

  /** The worktree file's text when it is a regular file small enough to read as UTF-8, else `null`. */
  private static async worktreeTextAsync(file: string): Promise<string | null> {
    try {
      const stats = await lstat(file);
      return stats.isFile() && stats.size <= Resources.conflictTextBytes ? ConflictReader.decode(await readFile(file)) : null;
    } catch (error) {
      if (FilePresence.isGone(error))
        return null;
      throw error;
    }
  }

  private static decode(bytes: Buffer): string | null {
    if (bytes.subarray(0, Resources.binaryProbeBytes).includes(0))
      return null;
    try {
      return new TextDecoder(Resources.utf8Encoding, { fatal: true, ignoreBOM: true }).decode(bytes);
    } catch {
      return null;
    }
  }
}
