/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { GitCommitSigning, SigningFormat, UntrustedSource } from "@noldova/git.protocol";

import { GitFailedException } from "../exceptions/git-failed.exception.ts";
import { GitArguments } from "../models/git-arguments.ts";
import { ProgramLimits } from "../models/program-limits.ts";
import { ProgramRun } from "../models/program-run.ts";
import { Resources } from "../resources.ts";
import type { ProgramRunner } from "./program-runner.ts";

/** Reads whether git signs a new commit, and in which format, from `commit.gpgsign` and `gpg.format`; it reads settings only and runs no signing program. */
export class CommitSigningReader {
  private static readonly LIMITS: ProgramLimits = new ProgramLimits(Resources.configOutputBytes, Resources.gitReadMilliseconds);
  private static readonly SIGNS: GitArguments = new GitArguments(Resources.commitSignsArguments);
  private static readonly FORMAT: GitArguments = new GitArguments(Resources.signingFormatArguments);
  private readonly runner: ProgramRunner;

  public constructor(runner: ProgramRunner) {
    this.runner = runner;
  }

  public async readAsync(top: string, signal?: AbortSignal): Promise<GitCommitSigning> {
    const [signs, format] = await Promise.all([this.valueAsync(CommitSigningReader.SIGNS, top, signal), this.valueAsync(CommitSigningReader.FORMAT, top, signal)]);
    return new GitCommitSigning(signs === Resources.configTrue, format === null ? SigningFormat.OpenPgp : Resources.signingFormats.get(format) ?? null);
  }

  /** The setting's value without git's line end, or null when it isn't set. */
  private async valueAsync(gitArguments: GitArguments, top: string, signal?: AbortSignal): Promise<string | null> {
    const result = await this.runner.runAsync(ProgramRun.readGit(gitArguments, top, CommitSigningReader.LIMITS, signal));
    if (result.exit.code === Resources.configNotFoundExitCode)
      return null;
    if (result.exit.code !== 0 || result.isTruncated)
      throw new GitFailedException(Resources.configCommand, { text: result.errors.toString(Resources.utf8Encoding), source: UntrustedSource.Repository });
    return result.output.toString(Resources.utf8Encoding).replace(Resources.configValueEnd, "");
  }
}
