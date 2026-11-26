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
import { ConflictLabels } from "../models/conflict-labels.ts";
import { ConflictMarkers } from "../models/conflict-markers.ts";
import { GitArguments } from "../models/git-arguments.ts";
import { HeadCommit } from "../models/head-commit.ts";
import { ProgramLimits } from "../models/program-limits.ts";
import type { ProgramResult } from "../models/program-result.ts";
import { ProgramRun } from "../models/program-run.ts";
import type { RepositoryFolders } from "../models/repository-folders.ts";
import { Resources } from "../resources.ts";
import { FilePresence } from "./file-presence.ts";
import { OperationReader } from "./operation.reader.ts";
import type { ProgramRunner } from "./program-runner.ts";

interface IStage {
  readonly mode: string;
  readonly id: string;
}

export class ConflictReader {
  private static readonly BASE: number = 1;
  private static readonly OURS: number = 2;
  private static readonly THEIRS: number = 3;
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
    const kind = Resources.stageKinds.get([...stages.keys()].toSorted((a, b) => a - b).join(""));
    if (kind === undefined)
      throw new ConflictGoneException();
    const operation = await OperationReader.readAsync(folders.gitFolder);
    const [baseText, oursText, theirsText, labels] = await Promise.all([this.textAsync(folders.top, stages.get(ConflictReader.BASE), signal),
      this.textAsync(folders.top, stages.get(ConflictReader.OURS), signal), this.textAsync(folders.top, stages.get(ConflictReader.THEIRS), signal),
      this.labelsAsync(folders, operation, signal)]);
    const texts: ReadonlyMap<number, string | null> = new Map([[ConflictReader.BASE, baseText], [ConflictReader.OURS, oursText], [ConflictReader.THEIRS, theirsText]]);
    const binary = [...stages.keys()].some(t => texts.get(t) === null);
    const base = binary ? null : baseText;
    const ours = binary ? null : oursText;
    const theirs = binary ? null : theirsText;
    let merged: string | null = null;
    let reused = false;
    if (ours !== null && theirs !== null) {
      const worktree = await ConflictReader.worktreeTextAsync(path.join(folders.top, file));
      reused = worktree !== null && !ConflictMarkers.has(worktree);
      merged = worktree !== null && reused ? worktree : await this.mergeAsync(folders.top, base, ours, theirs, labels, signal);
    }
    return new GitConflict(file, kind, operation?.kind ?? null, base, ours, theirs, merged, labels.ours, labels.theirs, labels.oursCommit, labels.theirsCommit,
      binary, reused);
  }

  private async stagesAsync(top: string, file: string, signal?: AbortSignal): Promise<Map<number, IStage>> {
    const result = await this.runGitAsync(top, new GitArguments(Resources.unmergedArguments).withPaths([file]), ConflictReader.LIST_LIMITS,
      Resources.lsFilesCommand, signal);
    const stages: Map<number, IStage> = new Map();
    for (const record of result.output.toString(Resources.utf8Encoding).split(Resources.nulCharacter)) {
      const match = Resources.unmergedRecordPattern.exec(record);
      if (match?.[1] !== undefined && match[2] !== undefined && match[3] !== undefined && match[4] === file)
        stages.set(Number(match[3]), { mode: match[1], id: match[2] });
    }
    return stages;
  }

  private async textAsync(top: string, stage: IStage | undefined, signal?: AbortSignal): Promise<string | null> {
    if (stage === undefined || !Resources.textModes.includes(stage.mode))
      return null;
    const result = await this.runner.runAsync(ProgramRun.readGit(new GitArguments(Resources.blobArguments).withRevisions([stage.id]), top,
      ConflictReader.BLOB_LIMITS, signal));
    if (result.exit.code !== 0 && !result.isTruncated)
      throw new GitFailedException(Resources.catFileCommand, { text: result.errors.toString(Resources.utf8Encoding), source: UntrustedSource.Repository });
    return result.isTruncated ? null : ConflictReader.decode(result.output);
  }

  private async mergeAsync(top: string, base: string | null, ours: string, theirs: string, labels: ConflictLabels, signal?: AbortSignal): Promise<string> {
    const folder = await mkdtemp(path.join(tmpdir(), Resources.conflictTemporaryPrefix));
    try {
      const baseFile = path.join(folder, Resources.baseFileName);
      const oursFile = path.join(folder, Resources.oursFileName);
      const theirsFile = path.join(folder, Resources.theirsFileName);
      await Promise.all([writeFile(baseFile, base ?? "", Resources.utf8Encoding), writeFile(oursFile, ours, Resources.utf8Encoding),
        writeFile(theirsFile, theirs, Resources.utf8Encoding)]);
      const gitArguments = new GitArguments([...Resources.mergeFileArguments, Resources.labelOption, labels.ours, Resources.labelOption, Resources.conflictBaseLabel,
        Resources.labelOption, labels.theirs], [], [oursFile, baseFile, theirsFile]);
      const result = await this.runner.runAsync(ProgramRun.readGit(gitArguments, top, ConflictReader.MERGE_LIMITS, signal));
      if (result.exit.code === null || result.exit.code >= Resources.gitFatalExitCode || result.isTruncated)
        throw new GitFailedException(Resources.mergeFileCommand, { text: result.errors.toString(Resources.utf8Encoding), source: UntrustedSource.Repository });
      return result.output.toString(Resources.utf8Encoding);
    } finally {
      await rm(folder, { recursive: true, force: true });
    }
  }

  private async labelsAsync(folders: RepositoryFolders, operation: GitOperation | null, signal?: AbortSignal): Promise<ConflictLabels> {
    if (operation?.kind === OperationKind.Rebase) {
      let onto: string | null = null;
      for (const folder of Resources.rebaseFolders)
        onto ??= await OperationReader.readLineAsync(path.join(folders.gitFolder, folder, Resources.ontoFile));
      const replayed = await OperationReader.readLineAsync(path.join(folders.gitFolder, Resources.rebaseHeadFile));
      const [ontoName, head] = await Promise.all([onto === null ? null : this.nameAsync(folders.top, onto, signal), this.headAsync(folders.top, signal)]);
      return new ConflictLabels(
        ontoName === null ? Resources.currentLabel : Resources.formatOntoLabel(ontoName),
        replayed === null ? Resources.incomingLabel : Resources.formatYourCommitLabel(replayed.slice(0, Resources.shortIdLength)),
        head.commit,
        ConflictReader.commitOf(replayed));
    }
    const from = operation?.from ?? null;
    if (operation === null || from === null) {
      const head = await this.headAsync(folders.top, signal);
      return new ConflictLabels(head.branch, Resources.incomingLabel, head.commit, null);
    }
    if (operation.kind === OperationKind.Merge) {
      const [head, name] = await Promise.all([this.headAsync(folders.top, signal), this.nameAsync(folders.top, from, signal)]);
      return new ConflictLabels(head.branch, name, head.commit, ConflictReader.commitOf(from));
    }
    const shortId = from.slice(0, Resources.shortIdLength);
    const head = await this.headAsync(folders.top, signal);
    return new ConflictLabels(head.branch, operation.kind === OperationKind.Revert ? Resources.formatRevertedLabel(shortId) : Resources.formatPickedLabel(shortId),
      head.commit, ConflictReader.commitOf(from));
  }

  private async headAsync(top: string, signal?: AbortSignal): Promise<HeadCommit> {
    const result = await this.runner.runAsync(ProgramRun.readGit(ConflictReader.HEAD, top, ConflictReader.LIST_LIMITS, signal));
    const lines: readonly string[] = result.exit.code === 0 ? result.output.toString(Resources.utf8Encoding).trim().split(Resources.linePattern) : [];
    return new HeadCommit(lines.at(1) ?? await this.branchAsync(top, signal), ConflictReader.commitOf(lines.at(0) ?? null));
  }

  private async branchAsync(top: string, signal?: AbortSignal): Promise<string> {
    const result = await this.runner.runAsync(ProgramRun.readGit(ConflictReader.BRANCH, top, ConflictReader.LIST_LIMITS, signal));
    const branch = result.output.toString(Resources.utf8Encoding).trim();
    return result.exit.code === 0 && branch.length > 0 ? branch : Resources.headLabel;
  }

  private static commitOf(line: string | null): string | null {
    return line !== null && Resources.objectIdPattern.test(line) ? line : null;
  }

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
