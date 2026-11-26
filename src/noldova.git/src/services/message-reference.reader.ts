/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { GitMessageReference, GitMessageReferences, UntrustedSource } from "@noldova/git.protocol";

import { GitFailedException } from "../exceptions/git-failed.exception.ts";
import { UnreadableOutputException } from "../exceptions/unreadable-output.exception.ts";
import { GitArguments } from "../models/git-arguments.ts";
import { ProgramLimits } from "../models/program-limits.ts";
import { ProgramRun } from "../models/program-run.ts";
import { Required } from "../models/required.ts";
import { Resources } from "../resources.ts";
import type { ProgramRunner } from "./program-runner.ts";

export class MessageReferenceReader {
  private static readonly LIMITS: ProgramLimits = new ProgramLimits(Resources.graphOutputBytes, Resources.gitReadMilliseconds);
  private static readonly HEAD: GitArguments = new GitArguments([...Resources.readCommitArguments, Resources.headRevision]);
  private static readonly MATCHES: GitArguments = new GitArguments(Resources.messageReferenceArguments);
  private readonly runner: ProgramRunner;

  public constructor(runner: ProgramRunner) {
    this.runner = runner;
  }

  public async readAsync(top: string, limit: number, signal?: AbortSignal): Promise<GitMessageReferences> {
    const listed = await this.runner.runAsync(ProgramRun.readGit(new GitArguments([...Resources.messageCommitArguments, Resources.formatMaxCount(limit + 1)]), top,
      MessageReferenceReader.LIMITS, signal));
    if (listed.exit.code !== 0) {
      const head = await this.runner.runAsync(ProgramRun.readGit(MessageReferenceReader.HEAD, top, MessageReferenceReader.LIMITS, signal));
      if (head.exit.code === Resources.revisionMissingExitCode)
        return new GitMessageReferences([], false);
      throw MessageReferenceReader.failed(listed.errors);
    }
    if (listed.isTruncated)
      throw MessageReferenceReader.unreadable();
    const ids = listed.output.toString(Resources.utf8Encoding).split(Resources.lineEnd).filter(t => t.length > 0);
    const shown = ids.slice(0, limit);
    if (shown.length === 0)
      return new GitMessageReferences([], false);
    const run = ProgramRun.readGit(MessageReferenceReader.MATCHES, top, MessageReferenceReader.LIMITS, signal)
      .withInput(Buffer.from(shown.map(t => t + Resources.lineEnd).join(""), Resources.utf8Encoding));
    const matched = await this.runner.runAsync(run);
    if (matched.exit.code !== 0)
      throw MessageReferenceReader.failed(matched.errors);
    if (matched.isTruncated)
      throw MessageReferenceReader.unreadable();
    return new GitMessageReferences(MessageReferenceReader.parse(matched.output.toString(Resources.utf8Encoding)), ids.length > limit);
  }

  public static numbersOf(message: string): number[] {
    return [...new Set(Array.from(message.matchAll(Resources.azureBoardsReferencePattern), t => Number(t[1])))];
  }

  private static parse(output: string): GitMessageReference[] {
    const fields = output.split(Resources.recordSeparator);
    if (fields.length % 2 !== 1 || fields.at(-1) !== "")
      throw MessageReferenceReader.unreadable();
    const references: GitMessageReference[] = [];
    for (let index = 0; index + 1 < fields.length; index += 2) {
      const id = Required.at(fields, index, Resources.logCommand, Resources.commitsPart);
      const message = Required.at(fields, index + 1, Resources.logCommand, Resources.commitsPart);
      if (!Resources.objectIdPattern.test(id))
        throw MessageReferenceReader.unreadable();
      const numbers = MessageReferenceReader.numbersOf(message);
      if (numbers.length > 0)
        references.push(new GitMessageReference(id, numbers));
    }
    return references;
  }

  private static failed(errors: Buffer): GitFailedException {
    return new GitFailedException(Resources.logCommand, { text: errors.toString(Resources.utf8Encoding), source: UntrustedSource.Repository });
  }

  private static unreadable(): UnreadableOutputException {
    return new UnreadableOutputException(Resources.logCommand, Resources.commitsPart);
  }
}
