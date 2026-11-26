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

export class GitWorkspaceBulk {
  private readonly client: GitRuntimeClient;
  private readonly errors: ErrorHandler;

  public constructor(client: GitRuntimeClient, errors: ErrorHandler) {
    this.client = client;
    this.errors = errors;
  }

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

  public pullAsync(targets: readonly GitBulkTarget[]): Promise<GitBulkResult> {
    return this.runAsync(targets, async target => {
      const status: GitStatus = await this.client.statusAsync(target.folder);
      if (!GitWorkspaceOverview.isOnlyBehind(new GitRepositorySummary(target.folder, status, false, null)))
        return Resources.bulkNotBehind;
      await this.client.pullAsync(target.folder, status.fingerprint);
      return null;
    });
  }

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
