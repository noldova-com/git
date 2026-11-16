/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import path from "node:path";

export class WorktreeEntry {
  public readonly path: string;
  public readonly head: string | null;
  public readonly branch: string | null;
  public readonly lockReason: string | null;
  public readonly isPrunable: boolean;

  public constructor(folder: string, head: string | null, branch: string | null, lockReason: string | null, isPrunable: boolean) {
    this.path = folder;
    this.head = head;
    this.branch = branch;
    this.lockReason = lockReason;
    this.isPrunable = isPrunable;
  }

  public get isLocked(): boolean {
    return this.lockReason !== null;
  }

  public isAt(folder: string): boolean {
    return path.resolve(this.path) === path.resolve(folder);
  }

  public isLockedElsewhere(ownReason: string): boolean {
    return this.lockReason !== null && this.lockReason !== ownReason;
  }
}
