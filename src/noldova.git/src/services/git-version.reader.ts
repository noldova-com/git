/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { UntrustedSource } from "@noldova/git.protocol";

import { GitFailedException } from "../exceptions/git-failed.exception.ts";
import { GitTooOldException } from "../exceptions/git-too-old.exception.ts";
import { GitArguments } from "../models/git-arguments.ts";
import { ProgramLimits } from "../models/program-limits.ts";
import { ProgramRun } from "../models/program-run.ts";
import { Resources } from "../resources.ts";
import type { ProgramRunner } from "./program-runner.ts";

export class GitVersionReader {
  private static readonly LIMITS: ProgramLimits = new ProgramLimits(Resources.lineOutputBytes, Resources.gitReadMilliseconds);
  private static readonly ARGUMENTS: GitArguments = new GitArguments(Resources.versionArguments);
  private readonly runner: ProgramRunner;
  private output: Promise<string> | null = null;

  public constructor(runner: ProgramRunner) {
    this.runner = runner;
  }

  public async requireAsync(folder: string): Promise<void> {
    const output = await this.readAsync(folder);
    if (!GitVersionReader.isAtLeast(output, Resources.oldestGitVersion))
      throw new GitTooOldException(GitVersionReader.versionOf(output));
  }

  /** Whether the person's git is at least this version, for a feature newer than the oldest git the module takes. */
  public async atLeastAsync(folder: string, version: readonly [number, number]): Promise<boolean> {
    return GitVersionReader.isAtLeast(await this.readAsync(folder), version);
  }

  private readAsync(folder: string): Promise<string> {
    this.output ??= this.runAsync(folder).catch((error: unknown) => {
      this.output = null;
      throw error;
    });
    return this.output;
  }

  private async runAsync(folder: string): Promise<string> {
    const result = await this.runner.runAsync(ProgramRun.readGit(GitVersionReader.ARGUMENTS, folder, GitVersionReader.LIMITS));
    if (result.exit.code !== 0)
      throw new GitFailedException(Resources.versionCommand, { text: result.errors.toString(Resources.utf8Encoding), source: UntrustedSource.Repository });
    return result.output.toString(Resources.utf8Encoding);
  }

  private static isAtLeast(output: string, [oldestMajor, oldestMinor]: readonly [number, number]): boolean {
    const match = Resources.versionPattern.exec(output);
    if (match === null)
      return false;
    const [major, minor] = [Number(match[1]), Number(match[2])];
    return major > oldestMajor || (major === oldestMajor && minor >= oldestMinor);
  }

  private static versionOf(output: string): string | null {
    return Resources.reportedVersionPattern.exec(output)?.[1] ?? null;
  }
}
