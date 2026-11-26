/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { GitCommitDetail, UntrustedSource } from "@noldova/git.protocol";

import { GitFailedException } from "../exceptions/git-failed.exception.ts";
import { GitArguments } from "../models/git-arguments.ts";
import { ProgramLimits } from "../models/program-limits.ts";
import { ProgramRun } from "../models/program-run.ts";
import { Resources } from "../resources.ts";
import type { ProgramRunner } from "./program-runner.ts";

export class CommitDetailReader {
  private static readonly LIMITS: ProgramLimits = new ProgramLimits(Resources.commitBodyBytes, Resources.gitReadMilliseconds);
  private readonly runner: ProgramRunner;

  public constructor(runner: ProgramRunner) {
    this.runner = runner;
  }

  public async readAsync(top: string, id: string, signal?: AbortSignal): Promise<GitCommitDetail> {
    const run = ProgramRun.readGit(new GitArguments(Resources.commitDetailArguments).withRevisions([id]), top, CommitDetailReader.LIMITS, signal);
    const result = await this.runner.runAsync(run);
    if (result.exit.code !== 0)
      throw new GitFailedException(Resources.logCommand, { text: result.errors.toString(Resources.utf8Encoding), source: UntrustedSource.Repository });
    const [committer = "", email = "", committedAt = "", ...body] = result.output.toString(Resources.utf8Encoding).split(Resources.nulCharacter);
    return new GitCommitDetail(id, body.join("").trimEnd(), committer, email, committedAt, result.isTruncated);
  }
}
