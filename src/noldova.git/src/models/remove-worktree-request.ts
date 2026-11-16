/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { RiskLevel, type WorktreeRecord } from "@noldova/git.protocol";

import type { ICallContext } from "../interfaces/i-call-context.ts";
import { Resources } from "../resources.ts";
import type { ChangedPaths } from "./changed-paths.ts";

export class RemoveWorktreeRequest {
  public readonly requester: string = Resources.moduleId;
  public readonly action: string = Resources.removeWorktreeAction;
  public readonly risk: RiskLevel = RiskLevel.LocalDestructive;
  public readonly scope: string;
  public readonly sessionId: string | null;
  public readonly worktree: string;
  public readonly branch: string;
  public readonly head: string;
  public readonly changes: ChangedPaths;
  public readonly snapshot: string | null = null;

  public constructor(context: ICallContext, record: WorktreeRecord, head: string, changes: ChangedPaths) {
    this.scope = context.scope;
    this.sessionId = context.sessionId ?? null;
    this.worktree = record.path;
    this.branch = record.branch;
    this.head = head;
    this.changes = changes;
  }

  public isCurrent(head: string, changes: ChangedPaths): boolean {
    return head === this.head && changes.equals(this.changes);
  }
}
