/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { GitRebaseCheck, GitRebaseStepCheck, RebaseAction, RebaseCheckOutcome, type RebaseStep } from "@noldova/git.protocol";

import { Resources } from "../resources.ts";
import type { FilterOptionsReader } from "./filter-options.reader.ts";
import type { GitVersionReader } from "./git-version.reader.ts";
import { MergeTreeReader } from "./merge-tree.reader.ts";
import type { ProgramRunner } from "./program-runner.ts";

/**
 * Checks an interactive rebase's steps before it starts: each kept step's commit is replayed with `git merge-tree` against its first parent, onto the tree the
 * steps before it left, starting from the target, so a step answers `Clean`, `Folded` for a squash or fixup, or `Conflicts` with the paths, and the
 * next step goes on from the merged tree, conflict markers and all. A dropped step answers `Dropped`. It needs git 2.45, whose `merge-tree` merges trees, and
 * every step answers `Unavailable` on an older git or while the repository's own configuration names a merge driver. It changes no ref, index or file.
 */
export class RebaseCheckReader {
  private readonly versions: GitVersionReader;
  private readonly merges: MergeTreeReader;

  public constructor(runner: ProgramRunner, versions: GitVersionReader, filters: FilterOptionsReader) {
    this.versions = versions;
    this.merges = new MergeTreeReader(runner, filters);
  }

  public async readAsync(top: string, onto: string, steps: readonly RebaseStep[], signal?: AbortSignal): Promise<GitRebaseCheck> {
    if (!await this.versions.atLeastAsync(top, Resources.mergeTreesVersion) || await this.merges.hasMergeDriversAsync(top, signal))
      return new GitRebaseCheck(steps.map(() => new GitRebaseStepCheck(RebaseCheckOutcome.Unavailable, [])));
    let current = onto;
    const checks: GitRebaseStepCheck[] = [];
    for (const step of steps) {
      if (step.action === RebaseAction.Drop) {
        checks.push(new GitRebaseStepCheck(RebaseCheckOutcome.Dropped, []));
        continue;
      }
      const merged = await this.merges.mergeAsync(top, [Resources.formatMergeBaseOption(Resources.formatFirstParentRevision(step.id))], [current, step.id], signal);
      current = merged.tree;
      const folds = step.action === RebaseAction.Squash || step.action === RebaseAction.Fixup;
      checks.push(new GitRebaseStepCheck(merged.paths.length > 0 ? RebaseCheckOutcome.Conflicts : folds ? RebaseCheckOutcome.Folded : RebaseCheckOutcome.Clean,
        merged.paths));
    }
    return new GitRebaseCheck(checks);
  }
}
