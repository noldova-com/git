/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

export class GitBranchDrop {
  public readonly source: string;
  public readonly sourceId: string;
  public readonly target: string;
  public readonly targetId: string;
  public readonly current: string | null;
  public readonly isTargetLocal: boolean;

  public constructor(source: string, sourceId: string, target: string, targetId: string, current: string | null, isTargetLocal: boolean) {
    this.source = source;
    this.sourceId = sourceId;
    this.target = target;
    this.targetId = targetId;
    this.current = current;
    this.isTargetLocal = isTargetLocal;
  }

  public get canMerge(): boolean {
    return this.target === this.current;
  }

  public get canSwitchAndMerge(): boolean {
    return !this.canMerge && this.isTargetLocal && this.sourceId !== this.targetId;
  }

  public get canRebase(): boolean {
    return this.source === this.current;
  }

  public get predicted(): string | null {
    if (this.sourceId === this.targetId)
      return null;
    if (this.canMerge)
      return this.sourceId;
    return this.canRebase ? this.targetId : null;
  }
}
