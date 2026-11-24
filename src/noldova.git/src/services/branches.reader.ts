/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */
import { GitBranches, GitBranchParams, GitBranchTip, GitBranchTrack, GitMergedBranches, GitRemoteTracks, UntrustedSource } from "@noldova/git.protocol";

import { GitFailedException } from "../exceptions/git-failed.exception.ts";
import { UnreadableOutputException } from "../exceptions/unreadable-output.exception.ts";
import { BranchHead } from "../models/branch-head.ts";
import { GitArguments } from "../models/git-arguments.ts";
import { ProgramLimits } from "../models/program-limits.ts";
import { ProgramRun } from "../models/program-run.ts";
import { Resources } from "../resources.ts";
import type { GitVersionReader } from "./git-version.reader.ts";
import { LogReader } from "./log.reader.ts";
import type { ProgramRunner } from "./program-runner.ts";

export class BranchesReader {
  private static readonly LIMITS: ProgramLimits = new ProgramLimits(Resources.branchesReadBytes, Resources.gitReadMilliseconds);
  private static readonly HEADS: GitArguments = new GitArguments(Resources.branchHeadsArguments);
  private static readonly CURRENT: GitArguments = new GitArguments(Resources.currentBranchArguments);
  private static readonly REMOTES: GitArguments = new GitArguments(Resources.remotesArguments);
  private static readonly REMOTE_HEADS: GitArguments = new GitArguments(Resources.remoteHeadsArguments);
  private static readonly HEAD_COMMIT: GitArguments = new GitArguments(Resources.headCommitCheckArguments);
  private static readonly REMOTE_TRACKS: GitArguments = new GitArguments(Resources.remoteTracksArguments);
  private static readonly NO_TRACKS: GitRemoteTracks = new GitRemoteTracks([]);
  private readonly runner: ProgramRunner;
  private readonly versions: GitVersionReader;

  public constructor(runner: ProgramRunner, versions: GitVersionReader) {
    this.runner = runner;
    this.versions = versions;
  }

  public async readAsync(top: string, signal?: AbortSignal): Promise<GitBranches> {
    const [headRefs, current, remotes, remoteHeads] = await Promise.all([
      this.runAsync(BranchesReader.HEADS, top, Resources.forEachRefCommand, signal),
      this.runner.runAsync(ProgramRun.readGit(BranchesReader.CURRENT, top, BranchesReader.LIMITS, signal)),
      this.runAsync(BranchesReader.REMOTES, top, Resources.remoteCommand, signal),
      this.runAsync(BranchesReader.REMOTE_HEADS, top, Resources.forEachRefCommand, signal)
    ]);
    if (current.exit.code !== 0 && current.exit.code !== Resources.notSymbolicExitCode)
      throw BranchesReader.failure(Resources.symbolicRefCommand, current.errors);
    const heads: readonly BranchHead[] = BranchesReader.refsOf(headRefs, Resources.branchRefsPrefix).map(t => BranchHead.parse(t));
    const remoteNames: readonly string[] = BranchesReader.remotesOf(remotes);
    return new GitBranches(current.exit.code === 0 ? BranchesReader.branchOf(current.output.toString(Resources.utf8Encoding).trim()) : null,
      heads.map(t => t.name),
      remoteNames,
      BranchesReader.refsOf(remoteHeads, Resources.remoteRefsPrefix).filter(t => BranchesReader.isRemoteBranch(t, remoteNames)),
      heads.map(t => new GitBranchTrack(t.name, BranchesReader.countOf(t.track, Resources.aheadPattern), BranchesReader.countOf(t.track, Resources.behindPattern)))
        .filter(t => t.ahead > 0 || t.behind > 0),
      heads.map(t => new GitBranchTip(t.name, t.id, LogReader.dateOf(t.committedAt, t.seconds))));
  }

  /** Reads the local branches merged into the first remote, in `git remote`'s order, whose HEAD names a branch, and the branch it names. */
  public async readMergedAsync(top: string, signal?: AbortSignal): Promise<GitMergedBranches> {
    const [remotes, remoteHeads] = await Promise.all([
      this.runAsync(BranchesReader.REMOTES, top, Resources.remoteCommand, signal),
      this.runAsync(BranchesReader.REMOTE_HEADS, top, Resources.forEachRefCommand, signal)
    ]);
    const heads: ReadonlySet<string> = new Set(BranchesReader.refsOf(remoteHeads, Resources.remoteRefsPrefix));
    const remote: string | undefined = remotes.split(Resources.linePattern)
      .find(t => GitBranchParams.isBranchName(t) && heads.has(`${t}${Resources.remoteHeadSuffix}`));
    if (remote === undefined)
      return new GitMergedBranches(null, []);
    const ref: string = Resources.formatRemoteHeadRef(remote);
    const [base, merged] = await Promise.all([
      this.runner.runAsync(ProgramRun.readGit(new GitArguments([...Resources.defaultBranchArguments, ref]), top, BranchesReader.LIMITS, signal)),
      this.runAsync(new GitArguments(Resources.formatMergedBranchesArguments(ref)), top, Resources.forEachRefCommand, signal)
    ]);
    if (base.exit.code !== 0 && base.exit.code !== Resources.notSymbolicExitCode)
      throw BranchesReader.failure(Resources.symbolicRefCommand, base.errors);
    const name: string = base.exit.code === 0 ? base.output.toString(Resources.utf8Encoding).trim() : `${remote}${Resources.remoteHeadSuffix}`;
    return new GitMergedBranches(name, BranchesReader.refsOf(merged, Resources.branchRefsPrefix));
  }

  /**
   * Reads how far each remote branch, but each remote's HEAD, is ahead of and behind HEAD, keeping those that aren't level with it, with one `for-each-ref`;
   * none on a git older than 2.41, which can't count them, or before HEAD's first commit; a ref that names no commit has no counts and is skipped.
   */
  public async readRemoteTracksAsync(top: string, signal?: AbortSignal): Promise<GitRemoteTracks> {
    if (!await this.versions.atLeastAsync(top, Resources.aheadBehindVersion))
      return BranchesReader.NO_TRACKS;
    const head = await this.runner.runAsync(ProgramRun.readGit(BranchesReader.HEAD_COMMIT, top, BranchesReader.LIMITS, signal));
    if (head.exit.code === Resources.noCommitExitCode)
      return BranchesReader.NO_TRACKS;
    if (head.exit.code !== 0)
      throw BranchesReader.failure(Resources.revParseCommand, head.errors);
    const [tracks, remotes] = await Promise.all([
      this.runAsync(BranchesReader.REMOTE_TRACKS, top, Resources.forEachRefCommand, signal),
      this.runAsync(BranchesReader.REMOTES, top, Resources.remoteCommand, signal)
    ]);
    const remoteNames: readonly string[] = BranchesReader.remotesOf(remotes);
    const records: readonly string[] = tracks.split(Resources.recordSeparator).map(t => t.trim()).filter(t => t.length > 0);
    return new GitRemoteTracks(records.flatMap(t => BranchesReader.remoteTrackOf(t))
      .filter(t => BranchesReader.isRemoteBranch(t.branch, remoteNames) && (t.ahead > 0 || t.behind > 0)));
  }

  private async runAsync(gitArguments: GitArguments, top: string, command: string, signal?: AbortSignal): Promise<string> {
    const result = await this.runner.runAsync(ProgramRun.readGit(gitArguments, top, BranchesReader.LIMITS, signal));
    if (result.exit.code !== 0)
      throw BranchesReader.failure(command, result.errors);
    if (result.isTruncated)
      throw new UnreadableOutputException(command, Resources.refsPart);
    return result.output.toString(Resources.utf8Encoding);
  }

  private static failure(command: string, errors: Buffer): GitFailedException {
    return new GitFailedException(command, { text: errors.toString(Resources.utf8Encoding), source: UntrustedSource.Repository });
  }

  private static remotesOf(output: string): string[] {
    return output.split(Resources.linePattern).filter(t => t.length > 0);
  }

  /** Whether a remote-tracking name is a branch the list can show: not a remote's own HEAD, which names its default branch, and a name the protocol takes. */
  private static isRemoteBranch(name: string, remotes: readonly string[]): boolean {
    return GitBranchParams.isBranchName(name) && !remotes.some(t => name === `${t}${Resources.remoteHeadSuffix}`);
  }

  private static refsOf(output: string, prefix: string): string[] {
    return output.split(Resources.recordSeparator).map(t => t.trim()).filter(t => t.startsWith(prefix)).map(t => t.slice(prefix.length))
      .filter(t => t.length > 0);
  }

  /** A remote branch's counts, or none for a ref that names no commit, which git prints with empty counts. */
  private static remoteTrackOf(record: string): readonly GitBranchTrack[] {
    const [, branch, ahead, behind] = Resources.remoteTrackPattern.exec(record) ?? [];
    if (branch === undefined)
      throw new UnreadableOutputException(Resources.forEachRefCommand, Resources.refsPart);
    return ahead === undefined ? [] : [new GitBranchTrack(branch, Number(ahead), Number(behind))];
  }

  private static countOf(track: string, pattern: RegExp): number {
    return Number(pattern.exec(track)?.[1] ?? 0);
  }

  private static branchOf(ref: string): string | null {
    const branch = ref.startsWith(Resources.branchRefsPrefix) ? ref.slice(Resources.branchRefsPrefix.length) : "";
    return branch.length === 0 ? null : branch;
  }
}
