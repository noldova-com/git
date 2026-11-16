/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { WorktreeRecord } from "@noldova/git.protocol";

import { WorktreeState } from "../enums/worktree-state.ts";

export class StoredWorktree {
  public readonly record: WorktreeRecord;
  public readonly state: WorktreeState;

  public constructor(record: WorktreeRecord, state: WorktreeState) {
    this.record = record;
    this.state = state;
  }

  public get isPending(): boolean {
    return this.state === WorktreeState.Pending;
  }
}
