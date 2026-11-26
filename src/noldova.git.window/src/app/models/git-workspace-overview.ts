/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import type { GitRemote } from "@noldova/git.protocol";

import { Resources } from "../../resources.ts";
import { GitAgentState } from "../enums/git-agent-state.ts";
import type { GitBulkResult } from "./git-bulk-result.ts";
import { GitBulkTarget } from "./git-bulk-target.ts";
import type { GitPullRequestList } from "./git-pull-request-list.ts";
import type { GitPullRequestRow } from "./git-pull-request-row.ts";
import { GitPullRequestStack } from "./git-pull-request-stack.ts";
import type { GitRepositorySummary } from "./git-repository-summary.ts";
import { GitSharedBranch } from "./git-shared-branch.ts";
import type { GitWorkspaceRow } from "./git-workspace-row.ts";
import type { GitWorkspaceRun } from "./git-workspace-run.ts";

export class GitWorkspaceOverview {
  public static sharedBranchOf(rows: readonly GitWorkspaceRow[]): GitSharedBranch | null {
    const groups: Map<string, GitWorkspaceRow[]> = new Map();
    for (const row of rows) {
      const branch: string | null = row.summary()?.branch ?? null;
      if (!Object.isNull(branch))
        groups.set(branch, [...groups.get(branch) ?? [], row]);
    }
    let shared: GitSharedBranch | null = null;
    for (const [branch, members] of groups)
      if (members.length > (shared?.rows.length ?? 1) && members.some(t => !Object.isNull(t.pullRequest())))
        shared = new GitSharedBranch(branch, members);
    return shared;
  }

  public static stacksOf(rows: readonly GitWorkspaceRow[]): readonly GitPullRequestStack[] {
    const seen: Set<GitPullRequestList> = new Set();
    const stacks: GitPullRequestStack[] = [];
    for (const row of rows) {
      const list: GitPullRequestList | null | undefined = row.openList();
      if (Object.isNullOrUndefined(list) || seen.has(list))
        continue;
      seen.add(list);
      const heads: ReadonlySet<string> = new Set(list.rows.map(t => t.headBranch));
      const taken: Set<GitPullRequestRow> = new Set();
      const aboveOf = (under: GitPullRequestRow): readonly GitPullRequestRow[] => list.rows.filter(t => t !== under && t.baseBranch === under.headBranch);
      for (const bottom of list.rows.filter(t => (Object.isNull(t.baseBranch) || !heads.has(t.baseBranch)) && aboveOf(t).length > 0)) {
        const run: GitPullRequestRow[] = [bottom];
        taken.add(bottom);
        for (const under of run)
          for (const above of aboveOf(under).filter(t => !taken.has(t))) {
            taken.add(above);
            run.push(above);
          }
        stacks.push(new GitPullRequestStack(row, bottom, run.slice(1)));
      }
    }
    return stacks;
  }

  public static conflictedOf(rows: readonly GitWorkspaceRow[]): readonly GitWorkspaceRow[] {
    return rows.filter(t => t.hasConflicts());
  }

  public static failingOf(rows: readonly GitWorkspaceRow[]): readonly GitWorkspaceRow[] {
    return rows.filter(t => t.failing() > 0);
  }

  public static behindOf(rows: readonly GitWorkspaceRow[]): readonly GitWorkspaceRow[] {
    return rows.filter(t => GitWorkspaceOverview.isOnlyBehind(t.summary()));
  }

  public static isOnlyBehind(summary: GitRepositorySummary | null): boolean {
    return !Object.isNull(summary) && !Object.isNull(summary.upstream) && summary.behind > 0 && summary.ahead === 0;
  }

  public static waitingOf(runs: readonly GitWorkspaceRun[]): readonly GitWorkspaceRun[] {
    return runs.filter(t => t.row.state === GitAgentState.WaitingForYou);
  }

  public static workingOf(runs: readonly GitWorkspaceRun[]): readonly GitWorkspaceRun[] {
    return runs.filter(t => t.row.state === GitAgentState.Working);
  }

  public static pushTargetsOf(shared: GitSharedBranch): readonly GitBulkTarget[] {
    return shared.rows.map(row => {
      const summary: GitRepositorySummary | null = row.summary();
      const remote: GitRemote | null = summary?.remote ?? null;
      return new GitBulkTarget(row.folder, row.name, shared.branch, GitWorkspaceOverview.pushUpstreamOf(summary?.upstream ?? null, remote), remote);
    });
  }

  public static pushUpstreamOf(upstream: string | null, remote: GitRemote | null): string | null {
    return !Object.isNull(upstream) && !Object.isNull(remote) && upstream.startsWith(Resources.formatRemotePrefix(remote.name)) ? upstream : null;
  }

  public static isSameRemote(read: GitRemote | null, confirmed: GitRemote | null): boolean {
    if (Object.isNull(read) || Object.isNull(confirmed))
      return read === confirmed;
    return read.name === confirmed.name && read.host === confirmed.host && read.path === confirmed.path && read.transport === confirmed.transport;
  }

  public static placeOf(remote: GitRemote | null): string | null {
    return Object.isNull(remote) || Object.isNull(remote.host) || Object.isNull(remote.path) ? null : `${remote.host}/${remote.path}`;
  }

  public static pullTargetsOf(rows: readonly GitWorkspaceRow[]): readonly GitBulkTarget[] {
    return rows.map(row => new GitBulkTarget(row.folder, row.name, row.branch(), null, null));
  }

  public static resultLinesOf(verb: string, result: GitBulkResult): readonly string[] {
    return [...result.done.length === 0 ? [] : [Resources.formatBulkDone(verb, result.done)], ...result.skipped.map(t => Resources.formatBulkSkipped(t.repository, t.reason)),
      ...result.failed.map(t => Resources.formatBulkFailed(t.repository, t.reason))];
  }
}
