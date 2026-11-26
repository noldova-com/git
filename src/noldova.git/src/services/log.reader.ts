/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */
import { GitCommit, GitLog, ProtocolException, UntrustedSource } from "@noldova/git.protocol";

import { GitFailedException } from "../exceptions/git-failed.exception.ts";
import { UnreadableOutputException } from "../exceptions/unreadable-output.exception.ts";
import { GitArguments } from "../models/git-arguments.ts";
import { ProgramLimits } from "../models/program-limits.ts";
import { ProgramRun } from "../models/program-run.ts";
import { Required } from "../models/required.ts";
import { Resources } from "../resources.ts";
import type { ProgramRunner } from "./program-runner.ts";

export class LogReader {
  private static readonly LIMITS: ProgramLimits = new ProgramLimits(Resources.listOutputBytes, Resources.gitReadMilliseconds);
  private static readonly HEAD: GitArguments = new GitArguments([...Resources.readCommitArguments, Resources.headRevision]);
  private readonly runner: ProgramRunner;

  public constructor(runner: ProgramRunner) {
    this.runner = runner;
  }

  public async readAsync(top: string, limit: number, signal?: AbortSignal): Promise<GitLog> {
    const gitArguments = new GitArguments([...Resources.logArguments, Resources.formatMaxCount(limit + 1)]);
    const result = await this.runner.runAsync(ProgramRun.readGit(gitArguments, top, LogReader.LIMITS, signal));
    if (result.exit.code !== 0) {
      const head = await this.runner.runAsync(ProgramRun.readGit(LogReader.HEAD, top, LogReader.LIMITS, signal));
      if (head.exit.code === Resources.revisionMissingExitCode)
        return new GitLog([], false);
      throw new GitFailedException(Resources.logCommand, { text: result.errors.toString(Resources.utf8Encoding), source: UntrustedSource.Repository });
    }
    if (result.isTruncated)
      throw LogReader.unreadable();
    const commits = LogReader.parse(result.output.toString(Resources.utf8Encoding));
    return new GitLog(commits.slice(0, limit), commits.length > limit);
  }

  public static toLine(text: string): string {
    const line = LogReader.withoutControls(text);
    if (line.length <= Resources.lineLimit)
      return line;
    const last = line.charCodeAt(Resources.lineLimit - 1);
    return line.slice(0, last >= Resources.highSurrogateStart && last <= Resources.highSurrogateEnd ? Resources.lineLimit - 1 : Resources.lineLimit);
  }

  public static dateOf(authoredAt: string, seconds: string): string {
    if (Resources.offsetDatePattern.test(authoredAt) || !Resources.epochSecondsPattern.test(seconds))
      return authoredAt;
    return new Date(Number(seconds) * Resources.millisecondsPerSecond).toISOString().replace(Resources.millisecondsPattern, Resources.utcSuffix);
  }

  public static withoutControls(text: string): string {
    return text.replaceAll(Resources.controlPattern, Resources.replacementCharacter);
  }

  private static parse(output: string): GitCommit[] {
    const fields = output.split(Resources.recordSeparator);
    if (fields.length % Resources.logFieldCount !== 1 || fields.at(-1) !== "")
      throw LogReader.unreadable();
    const commits: GitCommit[] = [];
    for (let index = 0; index + 1 < fields.length; index += Resources.logFieldCount) {
      const field = (offset: number): string => Required.at(fields, index + offset, Resources.logCommand, Resources.commitsPart);
      const [id, parents, author, authoredAt, seconds, subject] = [field(0), field(1), field(2), field(3), field(4), field(5)];
      try {
        commits.push(new GitCommit(id, parents.length === 0 ? [] : parents.split(Resources.wordSeparator), LogReader.toLine(author), LogReader.dateOf(authoredAt, seconds),
          LogReader.toLine(subject)));
      } catch (error) {
        if (error instanceof ProtocolException)
          throw LogReader.unreadable(error);
        throw error;
      }
    }
    return commits;
  }

  private static unreadable(cause?: unknown): UnreadableOutputException {
    return new UnreadableOutputException(Resources.logCommand, Resources.commitsPart, cause);
  }
}
