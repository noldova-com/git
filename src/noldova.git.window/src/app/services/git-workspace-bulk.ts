/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { ErrorHandler } from "@angular/core";
import "@noldova/context.core";
import { type GitBranches, GitBranchParams, type GitStatus } from "@noldova/git.protocol";

import { Resources } from "../../resources.ts";
import { GitBulkOutcome } from "../models/git-bulk-outcome.ts";
import { GitBulkResult } from "../models/git-bulk-result.ts";
import type { GitBulkTarget } from "../models/git-bulk-target.ts";
import { GitRepositorySummary } from "../models/git-repository-summary.ts";
import { GitWorkspaceOverview } from "../models/git-workspace-overview.ts";
import { GitRepositorySummaries } from "./git-repository-summaries.ts";
import { GitRuntimeClient } from "./git-runtime-client.ts";
import { GitViewStateService } from "./git-view-state.service.ts";

/**
 * The workspace page's writes to several repositories at once: a push of one branch, a fast-forward pull and a new branch. Each reads the repository's status
 * again just before it writes, and writes through the same request the history's toolbar sends, at most {@link GitRepositorySummaries.AT_ONCE}
 * at a time; one failing never stops the others, and nothing is retried.
 */
export class GitWorkspaceBulk {
  private readonly client: GitRuntimeClient;
  private readonly errors: ErrorHandler;

  public constructor(client: GitRuntimeClient, errors: ErrorHandler) {
    this.client = client;
    this.errors = errors;
  }

  /**
   * Pushes each target's branch to its upstream, never forced. A target without an upstream on its remote is skipped without a read, and so is
   * one whose repository has since switched to another branch, or whose upstream or remote is no longer the one the confirm named; nothing sets
   * an upstream.
   */
  public pushAsync(targets: readonly GitBulkTarget[]): Promise<GitBulkResult> {
    return this.runAsync(targets, async target => {
      if (Object.isNull(target.upstream))
        return Resources.bulkNoUpstream;
      const status: GitStatus = await this.client.statusAsync(target.folder);
      if (status.branch !== target.branch || GitWorkspaceOverview.pushUpstreamOf(status.upstream?.name ?? null, status.remote) !== target.upstream
        || !GitWorkspaceOverview.isSameRemote(status.remote, target.remote))
        return Resources.bulkBranchChanged;
      await this.client.pushAsync(target.folder, status.fingerprint);
      return null;
    });
  }

  /** Pulls each target, which only fast-forwards; one that is no longer behind its upstream alone, such as after a commit, is skipped. */
  public pullAsync(targets: readonly GitBulkTarget[]): Promise<GitBulkResult> {
    return this.runAsync(targets, async target => {
      const status: GitStatus = await this.client.statusAsync(target.folder);
      if (!GitWorkspaceOverview.isOnlyBehind(new GitRepositorySummary(target.folder, status, false, null)))
        return Resources.bulkNotBehind;
      await this.client.pullAsync(target.folder, status.fingerprint);
      return null;
    });
  }

  /**
   * Creates the branch in each target at its current commit and switches to it, as the history's Create branch does. A name the protocol
   * refuses skips every target unread; a repository that already has the branch is skipped and named, and nothing else is changed in it.
   */
  public createBranchAsync(targets: readonly GitBulkTarget[], name: string): Promise<GitBulkResult> {
    const isName: boolean = GitBranchParams.isBranchName(name);
    return this.runAsync(targets, async target => {
      if (!isName)
        return Resources.bulkBranchNameRefused;
      const branches: GitBranches = await this.client.branchesAsync(target.folder);
      if (branches.branches.includes(name))
        return Resources.formatBulkBranchExists(name);
      const status: GitStatus = await this.client.statusAsync(target.folder);
      await this.client.createBranchAsync(target.folder, name, status.fingerprint);
      return null;
    });
  }

  /** Runs the work on each target, which answers why it skipped one or null once it wrote; a failure is kept with its reason, and the rest go on. */
  private async runAsync(targets: readonly GitBulkTarget[], work: (target: GitBulkTarget) => Promise<string | null>): Promise<GitBulkResult> {
    const skipped: Map<GitBulkTarget, string> = new Map();
    const failed: Map<GitBulkTarget, string> = new Map();
    await GitRepositorySummaries.eachAsync(targets, async target => {
      try {
        const reason: string | null = await work(target);
        if (!Object.isNull(reason))
          skipped.set(target, reason);
      }
      catch (error) {
        if (!GitRuntimeClient.isFailure(error))
          this.errors.handleError(error);
        failed.set(target, GitViewStateService.messageOf(error));
      }
    });
    const outcomesOf = (reasons: ReadonlyMap<GitBulkTarget, string>): readonly GitBulkOutcome[] => targets.flatMap(t => {
      const reason: string | undefined = reasons.get(t);
      return Object.isUndefined(reason) ? [] : [new GitBulkOutcome(t.repository, reason)];
    });
    return new GitBulkResult(targets.filter(t => !skipped.has(t) && !failed.has(t)).map(t => t.repository), outcomesOf(skipped), outcomesOf(failed));
  }
}
