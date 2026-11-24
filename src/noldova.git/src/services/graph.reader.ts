/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { GitCommit, GitGraph, GitGraphCommit, GitRef, ProtocolException, RefKind, UntrustedSource } from "@noldova/git.protocol";

import { GitFailedException } from "../exceptions/git-failed.exception.ts";
import { UnreadableOutputException } from "../exceptions/unreadable-output.exception.ts";
import { GitArguments } from "../models/git-arguments.ts";
import { ProgramLimits } from "../models/program-limits.ts";
import { ProgramRun } from "../models/program-run.ts";
import { Required } from "../models/required.ts";
import { Resources } from "../resources.ts";
import { LogReader } from "./log.reader.ts";
import type { ProgramRunner } from "./program-runner.ts";

/** Reads the newest commits of every branch, remote branch and tag, with HEAD, in date order, and the labels on each. */
export class GraphReader {
  private static readonly LIMITS: ProgramLimits = new ProgramLimits(Resources.graphOutputBytes, Resources.gitReadMilliseconds);
  private static readonly HEAD: GitArguments = new GitArguments([...Resources.readCommitArguments, Resources.headRevision]);
  private readonly runner: ProgramRunner;

  public constructor(runner: ProgramRunner) {
    this.runner = runner;
  }

  public async readAsync(top: string, limit: number, skip: number, signal?: AbortSignal): Promise<GitGraph> {
    const gitArguments = new GitArguments([...Resources.graphArguments, Resources.formatMaxCount(limit + 1), Resources.formatSkip(skip)]);
    const result = await this.runner.runAsync(ProgramRun.readGit(gitArguments, top, GraphReader.LIMITS, signal));
    if (result.exit.code !== 0) {
      const head = await this.runner.runAsync(ProgramRun.readGit(GraphReader.HEAD, top, GraphReader.LIMITS, signal));
      if (head.exit.code === Resources.revisionMissingExitCode)
        return new GitGraph([], false);
      throw new GitFailedException(Resources.logCommand, { text: result.errors.toString(Resources.utf8Encoding), source: UntrustedSource.Repository });
    }
    if (result.isTruncated)
      throw GraphReader.unreadable();
    const commits = GraphReader.parse(result.output.toString(Resources.utf8Encoding));
    return new GitGraph(commits.slice(0, limit), commits.length > limit);
  }

  /** Turns git's full decorations, such as "HEAD -> refs/heads/main, refs/remotes/origin/main, tag: refs/tags/v1", into labels. */
  public static refsOf(decorations: string): GitRef[] {
    const refs: GitRef[] = [];
    for (const decoration of decorations.split(Resources.decorationSeparator).filter(t => t.length > 0)) {
      let name = decoration;
      if (name === Resources.headRevision) {
        refs.push(new GitRef(RefKind.Head, ""));
        continue;
      }
      if (name.startsWith(Resources.headPointerPrefix)) {
        name = name.slice(Resources.headPointerPrefix.length);
        refs.push(new GitRef(RefKind.Head, GraphReader.shortOf(name)));
      }
      if (name.startsWith(Resources.tagDecorationPrefix))
        refs.push(new GitRef(RefKind.Tag, LogReader.toLine(name.slice(Resources.tagDecorationPrefix.length + Resources.tagsPrefix.length))));
      else if (name.startsWith(Resources.branchRefsPrefix))
        refs.push(new GitRef(RefKind.Branch, LogReader.toLine(name.slice(Resources.branchRefsPrefix.length))));
      else if (name.startsWith(Resources.remoteRefsPrefix) && !name.endsWith(Resources.remoteHeadSuffix))
        refs.push(new GitRef(RefKind.RemoteBranch, LogReader.toLine(name.slice(Resources.remoteRefsPrefix.length))));
    }
    return refs;
  }

  private static shortOf(name: string): string {
    return LogReader.toLine(name.startsWith(Resources.branchRefsPrefix) ? name.slice(Resources.branchRefsPrefix.length) : name);
  }

  private static parse(output: string): GitGraphCommit[] {
    const fields = output.split(Resources.recordSeparator);
    if (fields.length % Resources.graphFieldCount !== 1 || fields.at(-1) !== "")
      throw GraphReader.unreadable();
    const commits: GitGraphCommit[] = [];
    for (let index = 0; index + 1 < fields.length; index += Resources.graphFieldCount) {
      const field = (offset: number): string => Required.at(fields, index + offset, Resources.logCommand, Resources.commitsPart);
      const [id, parents, author, email, authoredAt, seconds, subject, decorations] = [field(0), field(1), field(2), field(3), field(4), field(5), field(6), field(7)];
      try {
        const commit = new GitCommit(id, parents.length === 0 ? [] : parents.split(Resources.wordSeparator), LogReader.toLine(author), LogReader.dateOf(authoredAt, seconds),
          LogReader.toLine(subject));
        commits.push(new GitGraphCommit(commit, LogReader.toLine(email), GraphReader.refsOf(decorations)));
      }
      catch (error) {
        if (error instanceof ProtocolException)
          throw GraphReader.unreadable(error);
        throw error;
      }
    }
    return commits;
  }

  private static unreadable(cause?: unknown): UnreadableOutputException {
    return new UnreadableOutputException(Resources.logCommand, Resources.commitsPart, cause);
  }
}
