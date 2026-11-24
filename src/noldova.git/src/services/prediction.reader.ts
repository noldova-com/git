/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { GitPrediction, PredictionAction, PredictionOutcome } from "@noldova/git.protocol";

import { GitArguments } from "../models/git-arguments.ts";
import { ProgramLimits } from "../models/program-limits.ts";
import { ProgramRun } from "../models/program-run.ts";
import { Resources } from "../resources.ts";
import type { FilterOptionsReader } from "./filter-options.reader.ts";
import type { GitVersionReader } from "./git-version.reader.ts";
import { MergeTreeReader } from "./merge-tree.reader.ts";
import type { ProgramRunner } from "./program-runner.ts";

/**
 * Works out what merging a commit into HEAD, or cherry-picking or reverting it there, would do, with `git merge-tree`, which touches neither the working folder
 * nor the index. The repository's own filters are switched off, as for a status, and a merge driver its own configuration names makes the answer `Unavailable`,
 * so the read runs nothing the repository names.
 */
export class PredictionReader {
  private static readonly LIMITS: ProgramLimits = new ProgramLimits(Resources.lineOutputBytes, Resources.gitReadMilliseconds);
  private static readonly UNAVAILABLE: GitPrediction = new GitPrediction(PredictionOutcome.Unavailable, []);
  private readonly runner: ProgramRunner;
  private readonly versions: GitVersionReader;
  private readonly merges: MergeTreeReader;

  public constructor(runner: ProgramRunner, versions: GitVersionReader, filters: FilterOptionsReader) {
    this.runner = runner;
    this.versions = versions;
    this.merges = new MergeTreeReader(runner, filters);
  }

  public async readAsync(top: string, id: string, action: PredictionAction, signal?: AbortSignal): Promise<GitPrediction> {
    if (await this.merges.hasMergeDriversAsync(top, signal))
      return PredictionReader.UNAVAILABLE;
    return action === PredictionAction.Merge ? await this.mergeAsync(top, id, signal) : await this.pickAsync(top, id, action === PredictionAction.Revert, signal);
  }

  private async mergeAsync(top: string, id: string, signal?: AbortSignal): Promise<GitPrediction> {
    if (await this.isAncestorAsync(top, id, Resources.headRevision, signal))
      return new GitPrediction(PredictionOutcome.UpToDate, []);
    if (await this.isAncestorAsync(top, Resources.headRevision, id, signal))
      return new GitPrediction(PredictionOutcome.FastForward, []);
    const merged = await this.merges.mergeAsync(top, [], [Resources.headRevision, id], signal);
    return new GitPrediction(merged.paths.length > 0 ? PredictionOutcome.Conflicts : PredictionOutcome.Clean, merged.paths);
  }

  private async pickAsync(top: string, id: string, isRevert: boolean, signal?: AbortSignal): Promise<GitPrediction> {
    if (!await this.versions.atLeastAsync(top, Resources.mergeBaseOptionVersion))
      return PredictionReader.UNAVAILABLE;
    const lines = await this.merges.readIdsAsync(top, [Resources.formatParentsRevision(id), Resources.formatTreeRevision(Resources.headRevision)], signal);
    const [parent] = lines;
    if (lines.length < 2 || parent === undefined)
      return PredictionReader.UNAVAILABLE;
    const [base, theirs] = isRevert ? [id, parent] : [parent, id];
    const merged = await this.merges.mergeAsync(top, [Resources.formatMergeBaseOption(base)], [Resources.headRevision, theirs], signal);
    if (merged.paths.length > 0)
      return new GitPrediction(PredictionOutcome.Conflicts, merged.paths);
    return new GitPrediction(merged.tree === lines.at(-1) ? PredictionOutcome.UpToDate : PredictionOutcome.Clean, []);
  }

  private async isAncestorAsync(top: string, ancestor: string, descendant: string, signal?: AbortSignal): Promise<boolean> {
    const gitArguments = new GitArguments(Resources.isAncestorArguments, [ancestor, descendant]);
    const result = await this.runner.runAsync(ProgramRun.readGit(gitArguments, top, PredictionReader.LIMITS, signal));
    if (result.exit.code === Resources.notAncestorExitCode)
      return false;
    MergeTreeReader.requireSuccess(Resources.mergeBaseCommand, result);
    return true;
  }
}
