/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { computed, type ErrorHandler, type Signal } from "@angular/core";
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

/**
 * The workspace page's pull requests: each repository's current branch's, from the host that claims its branch's remote, read once when its row
 * first shows and again when the window takes the focus. A host that reads a branch's pull request answers it in any state with its checks, or the
 * head commit's checks without one; any other host's open list is searched for the branch. It also gathers the pull requests that ask the person
 * for a review across every listed repository, from each host that reads them, read again when the window takes the focus. A host's member that
 * throws is reported and taken as no answer.
 */
export class GitWorkspacePullRequests {
  /** What a remote's review read is kept under in {@link refreshed}, apart from its branch's and list's reads. */
  private static readonly reviewsKey: string = "reviews";

  private readonly errors: ErrorHandler;
  private readonly refreshed: Set<string> = new Set();

  public constructor(errors: ErrorHandler) {
    this.errors = errors;
  }

  /**
   * The current branch's pull request: undefined while no remote is known, no host claims it or no branch is out, null before the host has an
   * answer.
   */
  public branchOf(folder: string, summary: Signal<GitRepositorySummary | null>,
    list: Signal<GitPullRequestList | null | undefined> = this.listOf(folder, summary)): Signal<GitBranchPullRequest | null | undefined> {
    const remote: Signal<GitRemote | null> = computed(() => summary()?.remote ?? null, { equal: GitWorkspacePullRequests.isSameRemote });
    const branch: Signal<string | null> = computed(() => summary()?.branch ?? null);
    const head: Signal<string | null> = computed(() => summary()?.head ?? null);
    const host: Signal<IGitPullRequests | null> = computed(() => {
      const shown: GitRemote | null = remote();
      return shown === null ? null : GitPullRequests.of(shown);
    });
    /** The host's read of the branch, asked for only when the host, the remote, the branch or its head commit changes. */
    const read: Signal<Signal<GitBranchPullRequest | null> | null | undefined> = computed(() => {
      const provider: IGitPullRequests | null = host();
      const shown: GitRemote | null = remote();
      const name: string | null = branch();
      const commit: string | null = head();
      const branchFor: IGitPullRequests["branchFor"] = provider?.branchFor;
      return branchFor === undefined || shown === null || name === null ? undefined : this.attempt(() => branchFor.call(provider, folder, shown, name, commit), null);
    });
    return computed(() => {
      const listed: GitPullRequestList | null | undefined = list();
      if (listed !== undefined)
        return GitWorkspacePullRequests.branchIn(listed, branch());
      const answer: Signal<GitBranchPullRequest | null> | null | undefined = read();
      return answer === undefined || answer === null ? answer : answer();
    });
  }

  /**
   * The open list of the host that claims the repository's remote, for a host that reads no branch on its own: undefined for any other host, while
   * no remote is known or no host claims it, null before the host has an answer. It is asked for only when the host or the remote changes.
   */
  public listOf(folder: string, summary: Signal<GitRepositorySummary | null>): Signal<GitPullRequestList | null | undefined> {
    const remote: Signal<GitRemote | null> = computed(() => summary()?.remote ?? null, { equal: GitWorkspacePullRequests.isSameRemote });
    const list: Signal<Signal<GitPullRequestList | null> | null | undefined> = computed(() => {
      const shown: GitRemote | null = remote();
      const provider: IGitPullRequests | null = shown === null ? null : GitPullRequests.of(shown);
      return provider === null || shown === null || provider.branchFor !== undefined ? undefined : this.attempt(() => provider.listFor(folder, shown), null);
    });
    return computed(() => {
      const listed: Signal<GitPullRequestList | null> | null | undefined = list();
      return listed === undefined || listed === null ? listed : listed();
    });
  }

  /**
   * The host's whole open list, which the Dashboard's Open cell counts, whether or not the host reads branches on its own: undefined while no remote
   * is known or no host claims it, null before the host has an answer. It is asked for only when the host or the remote changes.
   */
  public openListOf(folder: string, summary: Signal<GitRepositorySummary | null>): Signal<GitPullRequestList | null | undefined> {
    const remote: Signal<GitRemote | null> = computed(() => summary()?.remote ?? null, { equal: GitWorkspacePullRequests.isSameRemote });
    const list: Signal<Signal<GitPullRequestList | null> | null | undefined> = computed(() => {
      const shown: GitRemote | null = remote();
      const provider: IGitPullRequests | null = shown === null ? null : GitPullRequests.of(shown);
      return provider === null || shown === null ? undefined : this.attempt(() => provider.listFor(folder, shown), null);
    });
    return computed(() => {
      const listed: Signal<GitPullRequestList | null> | null | undefined = list();
      return listed === undefined || listed === null ? listed : listed();
    });
  }

  /**
   * The open list the workspace page finds stacks in: the host's stack list when it has one, which nothing else reads, else the open list as
   * {@link listOf} reads it; undefined for a host with neither, while no remote is known or no host claims it, null before the host has an answer.
   * The stack list is asked for only when the host or the remote changes.
   */
  public stackListOf(folder: string, summary: Signal<GitRepositorySummary | null>,
    list: Signal<GitPullRequestList | null | undefined> = this.listOf(folder, summary)): Signal<GitPullRequestList | null | undefined> {
    const remote: Signal<GitRemote | null> = computed(() => summary()?.remote ?? null, { equal: GitWorkspacePullRequests.isSameRemote });
    const stacks: Signal<Signal<GitPullRequestList | null> | null | undefined> = computed(() => {
      const shown: GitRemote | null = remote();
      const provider: IGitPullRequests | null = shown === null ? null : GitPullRequests.of(shown);
      const stackListFor: IGitPullRequests["stackListFor"] = provider?.stackListFor;
      return stackListFor === undefined || shown === null ? undefined : this.attempt(() => stackListFor.call(provider, folder, shown), null);
    });
    return computed(() => {
      const read: Signal<GitPullRequestList | null> | null | undefined = stacks();
      return read === undefined ? list() : read === null ? null : read();
    });
  }

  /** Asks the repository's host to read its branch's pull request, or its list, once for each remote, branch and head commit until {@link forget}. */
  public refreshOnce(folder: string, summary: GitRepositorySummary | null): void {
    const remote: GitRemote | null = summary?.remote ?? null;
    const host: IGitPullRequests | null = remote === null ? null : GitPullRequests.of(remote);
    if (summary === null || remote === null || host === null)
      return;
    const refreshBranch: IGitPullRequests["refreshBranch"] = host.refreshBranch;
    const branch: string | null = summary.branch;
    const key: string = JSON.stringify(refreshBranch === undefined ? [folder, remote.name, remote.host, remote.path, remote.transport]
      : [folder, remote.name, remote.host, remote.path, remote.transport, branch, summary.head]);
    if (this.refreshed.has(key))
      return;
    this.refreshed.add(key);
    if (refreshBranch === undefined)
      this.attempt(() => host.refresh(folder, remote), undefined);
    else {
      if (branch !== null)
        this.attempt(() => refreshBranch.call(host, folder, remote, branch, summary.head), undefined);
      const listKey: string = JSON.stringify([folder, remote.name, remote.host, remote.path, remote.transport]);
      if (!this.refreshed.has(listKey)) {
        this.refreshed.add(listKey);
        this.attempt(() => host.refresh(folder, remote), undefined);
      }
    }
  }

  /**
   * The pull requests that ask the signed-in person for a review across the repositories, from each host that reads them: the repositories in their
   * order, each remote's once even when several folders share it, and the host's rows in its order. A signed-out host or one that never read adds
   * none, and a failed read keeps the rows the last one gave.
   */
  public reviewsOf(repositories: Signal<readonly GitWorkspaceRow[]>): Signal<GitWorkspaceReviews> {
    /** Each remote's host and review list, asked for only when the repositories or their remotes change. */
    const reads: Signal<readonly (readonly [GitWorkspaceRow, IGitPullRequests, Signal<GitPullRequestList | null>])[]> = computed(() => {
      const found: (readonly [GitWorkspaceRow, IGitPullRequests, Signal<GitPullRequestList | null>])[] = [];
      const seen: Set<string> = new Set();
      for (const row of repositories()) {
        const remote: GitRemote | null = row.summary()?.remote ?? null;
        const host: IGitPullRequests | null = remote === null ? null : GitPullRequests.of(remote);
        const reviewsFor: IGitPullRequests["reviewsFor"] = host?.reviewsFor;
        const key: string = JSON.stringify([remote?.host, remote?.path]);
        if (remote === null || host === null || reviewsFor === undefined || seen.has(key))
          continue;
        seen.add(key);
        const list: Signal<GitPullRequestList | null> | null = this.attempt(() => reviewsFor.call(host, remote), null);
        if (list !== null)
          found.push([row, host, list]);
      }
      return found;
    });
    return computed(() => {
      const rows: GitWorkspaceReview[] = [];
      let hasMore: boolean = false;
      for (const [row, host, list] of reads()) {
        const answer: GitPullRequestList | null = list();
        hasMore ||= answer?.hasMore === true;
        rows.push(...(answer?.rows ?? []).map(t => new GitWorkspaceReview(t, row.folder, row.name, host)));
      }
      return new GitWorkspaceReviews(rows, hasMore);
    });
  }

  /** Asks each repository's host to read its review requests, once for each remote until {@link forget}. */
  public refreshReviewsOnce(summaries: readonly (GitRepositorySummary | null)[]): void {
    for (const summary of summaries) {
      const remote: GitRemote | null = summary?.remote ?? null;
      const host: IGitPullRequests | null = remote === null ? null : GitPullRequests.of(remote);
      const refreshReviews: IGitPullRequests["refreshReviews"] = host?.refreshReviews;
      const key: string = JSON.stringify([GitWorkspacePullRequests.reviewsKey, remote?.host, remote?.path]);
      if (remote === null || refreshReviews === undefined || this.refreshed.has(key))
        continue;
      this.refreshed.add(key);
      this.attempt(() => refreshReviews.call(host, remote), undefined);
    }
  }

  /** Opens a review request in its host's own page when it has one; answers false when the host leaves it to the browser. */
  public openReview(review: GitWorkspaceReview): boolean {
    return this.attempt(() => review.host.open?.(review.folder, review.row) === true, false);
  }

  /** Lets every list be read again, such as when the window takes the focus. */
  public forget(): void {
    this.refreshed.clear();
  }

  /** Opens a pull request in its host's own page when it has one; answers false when the host leaves it to the browser. */
  public open(folder: string, summary: GitRepositorySummary | null, row: GitPullRequestRow): boolean {
    const remote: GitRemote | null = summary?.remote ?? null;
    const host: IGitPullRequests | null = remote === null ? null : GitPullRequests.of(remote);
    return host !== null && this.attempt(() => host.open?.(folder, row) === true, false);
  }

  /** The branch's open pull request in a host's list, or that the list has none for it, needs a sign-in, failed or still reads. */
  private static branchIn(list: GitPullRequestList | null, branch: string | null): GitBranchPullRequest | null {
    if (list === null)
      return null;
    const row: GitPullRequestRow | undefined = list.rows.find(t => t.headBranch === branch);
    if (row !== undefined)
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
    return a === b || (a !== null && b !== null && a.name === b.name && a.host === b.host && a.path === b.path && a.transport === b.transport);
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
