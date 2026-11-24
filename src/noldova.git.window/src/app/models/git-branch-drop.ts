/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

/** A branch dropped on another in the history: what it can do there, given the current branch. */
export class GitBranchDrop {
  public readonly source: string;
  public readonly sourceId: string;
  public readonly target: string;
  public readonly targetId: string;
  public readonly current: string | null;
  /** Whether the target is a local branch, which a switch can make current; a remote branch is not. */
  public readonly isTargetLocal: boolean;

  public constructor(source: string, sourceId: string, target: string, targetId: string, current: string | null, isTargetLocal: boolean) {
    this.source = source;
    this.sourceId = sourceId;
    this.target = target;
    this.targetId = targetId;
    this.current = current;
    this.isTargetLocal = isTargetLocal;
  }

  /** Whether the dropped branch merges into the target here: only into the current branch, which a merge changes in place. */
  public get canMerge(): boolean {
    return this.target === this.current;
  }

  /** Whether the merge can run once the target is switched to: a local target that isn't current, on another commit. */
  public get canSwitchAndMerge(): boolean {
    return !this.canMerge && this.isTargetLocal && this.sourceId !== this.targetId;
  }

  /** Whether the dropped branch rebases onto the target here: only the current branch, which the rebase screen replays. */
  public get canRebase(): boolean {
    return this.source === this.current;
  }

  /**
   * The commit to predict a merge of into the current branch, the one of the two that isn't current; a merge's conflicts are the same either way.
   * `null` when neither is current, or both point at the same commit.
   */
  public get predicted(): string | null {
    if (this.sourceId === this.targetId)
      return null;
    if (this.canMerge)
      return this.sourceId;
    return this.canRebase ? this.targetId : null;
  }
}
