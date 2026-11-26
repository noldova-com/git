/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { type GitRebaseCommit, RebaseAction, RebaseStep } from "@noldova/git.protocol";

import { Resources } from "../../resources.ts";
import { GitRebaseRowPlan } from "./git-rebase-row-plan.ts";

export class GitRebaseRow {
  private static readonly FOLDS: ReadonlySet<RebaseAction> = new Set<RebaseAction>([RebaseAction.Squash, RebaseAction.Fixup]);
  private static readonly MESSAGES: ReadonlySet<RebaseAction> = new Set<RebaseAction>([RebaseAction.Reword, RebaseAction.Squash]);

  public readonly commit: GitRebaseCommit;
  public readonly action: RebaseAction;
  public readonly message: string | null;

  public constructor(commit: GitRebaseCommit, action: RebaseAction, message: string | null = null) {
    this.commit = commit;
    this.action = action;
    this.message = message;
  }

  public get folds(): boolean {
    return GitRebaseRow.FOLDS.has(this.action);
  }

  public get takesMessage(): boolean {
    return GitRebaseRow.MESSAGES.has(this.action);
  }

  public withAction(action: RebaseAction): GitRebaseRow {
    return new GitRebaseRow(this.commit, action, this.message);
  }

  public withMessage(message: string): GitRebaseRow {
    return new GitRebaseRow(this.commit, this.action, message);
  }

  public static arrange(commits: readonly GitRebaseCommit[], fold: boolean): GitRebaseRow[] {
    const rows: GitRebaseRow[] = [];
    for (const commit of commits) {
      const target = fold ? rows.findIndex(t => t.commit.id === commit.fixupOf) : -1;
      if (target < 0) {
        rows.push(new GitRebaseRow(commit, RebaseAction.Pick));
        continue;
      }
      let at = target + 1;
      while (rows[at]?.commit.fixupOf === commit.fixupOf)
        at++;
      rows.splice(at, 0, new GitRebaseRow(commit, commit.subject.startsWith(Resources.squashPrefix) ? RebaseAction.Squash : RebaseAction.Fixup));
    }
    return rows;
  }

  public static move(rows: readonly GitRebaseRow[], from: number, to: number): GitRebaseRow[] {
    const moved = [...rows];
    moved.splice(to, 0, ...moved.splice(from, 1));
    return moved;
  }

  public static isValid(rows: readonly GitRebaseRow[]): boolean {
    return rows.find(t => t.action !== RebaseAction.Drop)?.folds !== true;
  }

  public static planOf(rows: readonly GitRebaseRow[]): GitRebaseRowPlan {
    const steps: RebaseStep[] = [];
    const results: string[] = [];
    let current = "";
    for (const row of rows) {
      let message: string | null = null;
      if (row.action === RebaseAction.Squash) {
        current = row.message ?? Resources.formatSquashMessage(current, row.commit.message);
        message = current;
        results.splice(-1, 1, current);
      } else if (row.action === RebaseAction.Reword) {
        current = row.message ?? row.commit.message;
        message = current;
        results.push(current);
      } else if (row.action === RebaseAction.Pick || row.action === RebaseAction.Edit) {
        current = row.commit.message;
        results.push(current);
      }
      steps.push(new RebaseStep(row.commit.id, row.action, message));
    }
    return new GitRebaseRowPlan(steps, results);
  }
}
