/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { computed, type ErrorHandler, type Signal } from "@angular/core";
import "@noldova/context.core";
import type { GitRemote } from "@noldova/git.protocol";

import { GitPullRequestState } from "../enums/git-pull-request-state.ts";
import { GitPullRequestsState } from "../enums/git-pull-requests-state.ts";
import type { IGitPullRequests } from "../interfaces/i-git-pull-requests.ts";
import { GitBranchPullRequest } from "../models/git-branch-pull-request.ts";
import type { GitPullRequestList } from "../models/git-pull-request-list.ts";
import type { GitPullRequestRow } from "../models/git-pull-request-row.ts";
import type { GitRepositorySummary } from "../models/git-repository-summary.ts";
import { GitWorkspaceReview } from "../models/git-workspace-review.ts";
import { GitWorkspaceReviews } from "../models/git-workspace-reviews.ts";
import type { GitWorkspaceRow } from "../models/git-workspace-row.ts";
import { GitPullRequests } from "./git-pull-requests.ts";
import { GitReviewsRead } from "../models/git-reviews-read.ts";

export class GitWorkspacePullRequests {
  private static readonly reviewsKey: string = "reviews";

  private readonly errors: ErrorHandler;
  private readonly refreshed: Set<string> = new Set();

  public constructor(errors: ErrorHandler) {
    this.errors = errors;
  }

  public branchOf(folder: string, summary: Signal<GitRepositorySummary | null>,
    list: Signal<GitPullRequestList | null | undefined> = this.listOf(folder, summary)): Signal<GitBranchPullRequest | null | undefined> {
    const remote: Signal<GitRemote | null> = computed(() => summary()?.remote ?? null, { equal: GitWorkspacePullRequests.isSameRemote });
    const branch: Signal<string | null> = computed(() => summary()?.branch ?? null);
    const head: Signal<string | null> = computed(() => summary()?.head ?? null);
    const host: Signal<IGitPullRequests | null> = computed(() => {
      const shown: GitRemote | null = remote();
      return Object.isNull(shown) ? null : GitPullRequests.of(shown);
    });
    const read: Signal<Signal<GitBranchPullRequest | null> | null | undefined> = computed(() => {
      const provider: IGitPullRequests | null = host();
      const shown: GitRemote | null = remote();
      const name: string | null = branch();
      const commit: string | null = head();
      const branchFor: IGitPullRequests["branchFor"] = provider?.branchFor;
      return Object.isUndefined(branchFor) || Object.isNull(shown) || Object.isNull(name) ? undefined : this.attempt(() => branchFor.call(provider, folder, shown, name, commit), null);
    });
    return computed(() => {
      const listed: GitPullRequestList | null | undefined = list();
      if (!Object.isUndefined(listed))
        return GitWorkspacePullRequests.branchIn(listed, branch());
      const answer: Signal<GitBranchPullRequest | null> | null | undefined = read();
      return Object.isNullOrUndefined(answer) ? answer : answer();
    });
  }

  public listOf(folder: string, summary: Signal<GitRepositorySummary | null>): Signal<GitPullRequestList | null | undefined> {
    const remote: Signal<GitRemote | null> = computed(() => summary()?.remote ?? null, { equal: GitWorkspacePullRequests.isSameRemote });
    const list: Signal<Signal<GitPullRequestList | null> | null | undefined> = computed(() => {
      const shown: GitRemote | null = remote();
      const provider: IGitPullRequests | null = Object.isNull(shown) ? null : GitPullRequests.of(shown);
      return Object.isNull(provider) || Object.isNull(shown) || !Object.isUndefined(provider.branchFor) ? undefined : this.attempt(() => provider.listFor(folder, shown), null);
    });
    return computed(() => {
      const listed: Signal<GitPullRequestList | null> | null | undefined = list();
      return Object.isNullOrUndefined(listed) ? listed : listed();
    });
  }

  public openListOf(folder: string, summary: Signal<GitRepositorySummary | null>): Signal<GitPullRequestList | null | undefined> {
    const remote: Signal<GitRemote | null> = computed(() => summary()?.remote ?? null, { equal: GitWorkspacePullRequests.isSameRemote });
    const list: Signal<Signal<GitPullRequestList | null> | null | undefined> = computed(() => {
      const shown: GitRemote | null = remote();
      const provider: IGitPullRequests | null = Object.isNull(shown) ? null : GitPullRequests.of(shown);
      return Object.isNull(provider) || Object.isNull(shown) ? undefined : this.attempt(() => provider.listFor(folder, shown), null);
    });
    return computed(() => {
      const listed: Signal<GitPullRequestList | null> | null | undefined = list();
      return Object.isNullOrUndefined(listed) ? listed : listed();
    });
  }

  public stackListOf(folder: string, summary: Signal<GitRepositorySummary | null>,
    list: Signal<GitPullRequestList | null | undefined> = this.listOf(folder, summary)): Signal<GitPullRequestList | null | undefined> {
    const remote: Signal<GitRemote | null> = computed(() => summary()?.remote ?? null, { equal: GitWorkspacePullRequests.isSameRemote });
    const stacks: Signal<Signal<GitPullRequestList | null> | null | undefined> = computed(() => {
      const shown: GitRemote | null = remote();
      const provider: IGitPullRequests | null = Object.isNull(shown) ? null : GitPullRequests.of(shown);
      const stackListFor: IGitPullRequests["stackListFor"] = provider?.stackListFor;
      return Object.isUndefined(stackListFor) || Object.isNull(shown) ? undefined : this.attempt(() => stackListFor.call(provider, folder, shown), null);
    });
    return computed(() => {
      const read: Signal<GitPullRequestList | null> | null | undefined = stacks();
      return Object.isUndefined(read) ? list() : Object.isNull(read) ? null : read();
    });
  }

  public refreshOnce(folder: string, summary: GitRepositorySummary | null): void {
    const remote: GitRemote | null = summary?.remote ?? null;
    const host: IGitPullRequests | null = Object.isNull(remote) ? null : GitPullRequests.of(remote);
    if (Object.isNull(summary) || Object.isNull(remote) || Object.isNull(host))
      return;
    const refreshBranch: IGitPullRequests["refreshBranch"] = host.refreshBranch;
    const branch: string | null = summary.branch;
    const key: string = JSON.stringify(Object.isUndefined(refreshBranch) ? [folder, remote.name, remote.host, remote.path, remote.transport]
      : [folder, remote.name, remote.host, remote.path, remote.transport, branch, summary.head]);
    if (this.refreshed.has(key))
      return;
    this.refreshed.add(key);
    if (Object.isUndefined(refreshBranch))
      this.attempt(() => host.refresh(folder, remote), undefined);
    else {
      if (!Object.isNull(branch))
        this.attempt(() => refreshBranch.call(host, folder, remote, branch, summary.head), undefined);
      const listKey: string = JSON.stringify([folder, remote.name, remote.host, remote.path, remote.transport]);
      if (!this.refreshed.has(listKey)) {
        this.refreshed.add(listKey);
        this.attempt(() => host.refresh(folder, remote), undefined);
      }
    }
  }

  public reviewsOf(repositories: Signal<readonly GitWorkspaceRow[]>): Signal<GitWorkspaceReviews> {
    const reads: Signal<readonly GitReviewsRead[]> = computed(() => {
      const found: GitReviewsRead[] = [];
      const seen: Set<string> = new Set();
      for (const row of repositories()) {
        const remote: GitRemote | null = row.summary()?.remote ?? null;
        const host: IGitPullRequests | null = Object.isNull(remote) ? null : GitPullRequests.of(remote);
        const reviewsFor: IGitPullRequests["reviewsFor"] = host?.reviewsFor;
        const key: string = JSON.stringify([remote?.host, remote?.path]);
        if (Object.isNull(remote) || Object.isNull(host) || Object.isUndefined(reviewsFor) || seen.has(key))
          continue;
        seen.add(key);
        const list: Signal<GitPullRequestList | null> | null = this.attempt(() => reviewsFor.call(host, remote), null);
        if (!Object.isNull(list))
          found.push(new GitReviewsRead(row, host, list));
      }
      return found;
    });
    return computed(() => {
      const rows: GitWorkspaceReview[] = [];
      let hasMore: boolean = false;
      for (const { row, host, list } of reads()) {
        const answer: GitPullRequestList | null = list();
        hasMore ||= answer?.hasMore === true;
        rows.push(...(answer?.rows ?? []).map(t => new GitWorkspaceReview(t, row.folder, row.name, host)));
      }
      return new GitWorkspaceReviews(rows, hasMore);
    });
  }

  public refreshReviewsOnce(summaries: readonly (GitRepositorySummary | null)[]): void {
    for (const summary of summaries) {
      const remote: GitRemote | null = summary?.remote ?? null;
      const host: IGitPullRequests | null = Object.isNull(remote) ? null : GitPullRequests.of(remote);
      const refreshReviews: IGitPullRequests["refreshReviews"] = host?.refreshReviews;
      const key: string = JSON.stringify([GitWorkspacePullRequests.reviewsKey, remote?.host, remote?.path]);
      if (Object.isNull(remote) || Object.isUndefined(refreshReviews) || this.refreshed.has(key))
        continue;
      this.refreshed.add(key);
      this.attempt(() => refreshReviews.call(host, remote), undefined);
    }
  }

  public openReview(review: GitWorkspaceReview): boolean {
    return this.attempt(() => review.host.open?.(review.folder, review.row) === true, false);
  }

  public forget(): void {
    this.refreshed.clear();
  }

  public open(folder: string, summary: GitRepositorySummary | null, row: GitPullRequestRow): boolean {
    const remote: GitRemote | null = summary?.remote ?? null;
    const host: IGitPullRequests | null = Object.isNull(remote) ? null : GitPullRequests.of(remote);
    return !Object.isNull(host) && this.attempt(() => host.open?.(folder, row) === true, false);
  }

  private static branchIn(list: GitPullRequestList | null, branch: string | null): GitBranchPullRequest | null {
    if (Object.isNull(list))
      return null;
    const row: GitPullRequestRow | undefined = list.rows.find(t => t.headBranch === branch);
    if (!Object.isUndefined(row))
      return GitBranchPullRequest.of(row, row.isDraft ? GitPullRequestState.Draft : GitPullRequestState.Open, false);
    switch (list.state) {
      case GitPullRequestsState.Ready:
        return GitBranchPullRequest.none(0, 0, 0);
      case GitPullRequestsState.SignedOut:
        return GitBranchPullRequest.signedOut();
      case GitPullRequestsState.Failed:
        return GitBranchPullRequest.failed(list.failure);
      default:
        return GitBranchPullRequest.reading();
    }
  }

  private static isSameRemote(a: GitRemote | null, b: GitRemote | null): boolean {
    return a === b || (!Object.isNull(a) && !Object.isNull(b) && a.name === b.name && a.host === b.host && a.path === b.path && a.transport === b.transport);
  }

  private attempt<T>(run: () => T, fallback: T): T {
    try {
      return run();
    }
    catch (error) {
      this.errors.handleError(error);
      return fallback;
    }
  }
}
