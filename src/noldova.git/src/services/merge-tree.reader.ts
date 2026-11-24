/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { UntrustedSource } from "@noldova/git.protocol";

import { GitFailedException } from "../exceptions/git-failed.exception.ts";
import { GitArguments } from "../models/git-arguments.ts";
import { MergedTree } from "../models/merged-tree.ts";
import { ProgramLimits } from "../models/program-limits.ts";
import { ProgramRun } from "../models/program-run.ts";
import type { ProgramResult } from "../models/program-result.ts";
import { Resources } from "../resources.ts";
import type { FilterOptionsReader } from "./filter-options.reader.ts";
import type { ProgramRunner } from "./program-runner.ts";

/**
 * Merges trees with `git merge-tree`, which writes objects but no ref and touches neither the working folder nor the index, with the repository's own
 * filters switched off, as for a status; and reads whether the repository's own configuration names a merge driver, which would make a merge run it.
 */
export class MergeTreeReader {
  private static readonly LIMITS: ProgramLimits = new ProgramLimits(Resources.lineOutputBytes, Resources.gitReadMilliseconds);
  private static readonly TREE_LIMITS: ProgramLimits = new ProgramLimits(Resources.writeOutputBytes, Resources.gitReadMilliseconds);
  private static readonly DRIVERS: GitArguments = new GitArguments(Resources.mergeDriverArguments);
  private readonly runner: ProgramRunner;
  private readonly filters: FilterOptionsReader;

  public constructor(runner: ProgramRunner, filters: FilterOptionsReader) {
    this.runner = runner;
    this.filters = filters;
  }

  public async hasMergeDriversAsync(top: string, signal?: AbortSignal): Promise<boolean> {
    const result = await this.runner.runAsync(ProgramRun.readGit(MergeTreeReader.DRIVERS, top, MergeTreeReader.LIMITS, signal));
    if (result.exit.code === Resources.configNotFoundExitCode)
      return false;
    MergeTreeReader.requireSuccess(Resources.configCommand, result);
    return result.output.toString(Resources.utf8Encoding).split(Resources.lineEnd)
      .some(t => Resources.repositoryConfigScopes.has(t.slice(0, t.indexOf(Resources.tab))));
  }

  /** The merged tree, holding conflict markers where it conflicts, and the paths that conflict. */
  public async mergeAsync(top: string, options: readonly string[], revisions: readonly string[], signal?: AbortSignal)
    : Promise<MergedTree> {
    const filters = await this.filters.readAsync(top, signal);
    const gitArguments = new GitArguments([...Resources.mergeTreeArguments, ...options], revisions).withSettings(filters);
    const result = await this.runner.runAsync(ProgramRun.readGit(gitArguments, top, MergeTreeReader.TREE_LIMITS, signal));
    MergeTreeReader.requireSuccess(Resources.mergeTreeCommand, result, Resources.mergeTreeConflictsExitCode);
    const [tree = "", ...paths] = result.output.toString(Resources.utf8Encoding).split(Resources.nulCharacter);
    return new MergedTree(tree, [...new Set(paths.filter(t => t.length > 0))]);
  }

  /** Each revision's object id, in order, from one `git rev-parse`. */
  public async readIdsAsync(top: string, revisions: readonly string[], signal?: AbortSignal): Promise<string[]> {
    const gitArguments = new GitArguments([...Resources.predictRevisionsArguments, ...revisions]);
    const result = await this.runner.runAsync(ProgramRun.readGit(gitArguments, top, MergeTreeReader.LIMITS, signal));
    MergeTreeReader.requireSuccess(Resources.revParseCommand, result);
    return result.output.toString(Resources.utf8Encoding).split(Resources.lineEnd).filter(t => t.length > 0);
  }

  public static requireSuccess(command: string, result: ProgramResult, otherCode: number = 0): void {
    if ((result.exit.code !== 0 && result.exit.code !== otherCode) || result.isTruncated)
      throw new GitFailedException(command, { text: result.errors.toString(Resources.utf8Encoding), source: UntrustedSource.Repository });
  }
}
