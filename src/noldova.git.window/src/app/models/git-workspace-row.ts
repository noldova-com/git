/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { computed, type Signal, signal } from "@angular/core";
import "@noldova/context.core";

import { GitPullRequestState } from "../enums/git-pull-request-state.ts";
import { GitPullRequestsState } from "../enums/git-pull-requests-state.ts";
import { GitWorkspaceView } from "../enums/git-workspace-view.ts";
import { Resources } from "../../resources.ts";
import { CommitLabels } from "../services/commit-labels.ts";
import type { GitBranchPullRequest } from "./git-branch-pull-request.ts";
import type { GitPullRequestList } from "./git-pull-request-list.ts";
import type { GitPullRequestRow } from "./git-pull-request-row.ts";
import type { GitRepositorySummary } from "./git-repository-summary.ts";

export class GitWorkspaceRow {
  public readonly folder: string;
  public readonly name: string;
  public readonly summary: Signal<GitRepositorySummary | null>;
  public readonly branch: Signal<string>;
  public readonly sync: Signal<string>;
  public readonly changes: Signal<string>;
  public readonly fetched: Signal<string>;
  public readonly failure: Signal<string | null>;
  public readonly conflicts: Signal<number>;
  public readonly hasConflicts: Signal<boolean>;
  public readonly pullRequest: Signal<GitPullRequestRow | null>;
  public readonly openList: Signal<GitPullRequestList | null | undefined>;
  public readonly stackedOn: Signal<GitPullRequestRow | null>;
  public readonly pullRequestText: Signal<string>;
  public readonly checks: Signal<string>;
  public readonly checksTone: Signal<string>;
  public readonly failing: Signal<number>;
  public readonly hostState: Signal<GitPullRequestsState | null>;
  public readonly open: Signal<string>;
  public readonly openTitle: Signal<string>;
  public readonly views: Signal<ReadonlySet<GitWorkspaceView>>;

  public constructor(folder: string, summary: Signal<GitRepositorySummary | null>, pullRequest: Signal<GitBranchPullRequest | null | undefined>,
    hasAgentsAtWork: Signal<boolean>, openList: Signal<GitPullRequestList | null | undefined> = signal(undefined),
    opened: Signal<GitPullRequestList | null | undefined> = signal(undefined)) {
    this.folder = folder;
    this.name = Resources.formatHistoryTitle(folder);
    this.summary = summary;
    this.failure = computed(() => summary()?.failure ?? null);
    this.conflicts = computed(() => summary()?.conflicts ?? 0);
    this.hasConflicts = computed(() => this.conflicts() > 0);
    this.branch = computed(() => GitWorkspaceRow.branchOf(summary()));
    this.sync = computed(() => GitWorkspaceRow.syncOf(summary()));
    this.changes = computed(() => GitWorkspaceRow.changesOf(summary()));
    this.fetched = computed(() => GitWorkspaceRow.fetchedOf(summary(), new Date()));
    this.pullRequest = computed(() => pullRequest()?.pullRequest ?? null);
    this.openList = openList;
    this.stackedOn = computed(() => GitWorkspaceRow.stackedOnOf(this.pullRequest(), openList()));
    this.pullRequestText = computed(() => {
      const text: string = GitWorkspaceRow.pullRequestTextOf(summary(), pullRequest());
      const under: GitPullRequestRow | null = this.stackedOn();
      return Object.isNull(under) ? text : Resources.formatStackedOn(text, under.label);
    });
    const counted: Signal<GitBranchPullRequest | null> = computed(() => GitWorkspaceRow.countedOf(summary(), pullRequest()));
    this.checks = computed(() => GitWorkspaceRow.checksOf(counted()));
    this.checksTone = computed(() => GitWorkspaceRow.checksToneOf(counted()));
    this.failing = computed(() => counted()?.failing ?? 0);
    this.hostState = computed(() => pullRequest()?.state ?? null);
    const ready: Signal<GitPullRequestList | null> = computed(() => {
      const listed: GitPullRequestList | null | undefined = opened();
      return Object.isNullOrUndefined(listed) || listed.state !== GitPullRequestsState.Ready ? null : listed;
    });
    this.open = computed(() => {
      const listed: GitPullRequestList | null = ready();
      return Object.isNull(listed) ? "" : Resources.formatOpenPullRequests(listed.rows.length, listed.hasMore, listed.rows.filter(t => t.failing > 0).length);
    });
    this.openTitle = computed(() => {
      const listed: GitPullRequestList | null = ready();
      return Object.isNull(listed) ? "" : Resources.formatOpenPullRequestsTitle(listed.rows.length, listed.hasMore, listed.rows.filter(t => t.failing > 0).length);
    });
    this.views = computed(() => GitWorkspaceRow.viewsOf(summary(), pullRequest(), hasAgentsAtWork()));
  }

  public static viewsOf(summary: GitRepositorySummary | null, shown: GitBranchPullRequest | null | undefined, hasAgentsAtWork: boolean): ReadonlySet<GitWorkspaceView> {
    const views: Set<GitWorkspaceView> = new Set();
    if (hasAgentsAtWork)
      views.add(GitWorkspaceView.AgentsAtWork);
    if (Object.isNull(summary) || summary.isUnread)
      return views;
    if (summary.behind > 0)
      views.add(GitWorkspaceView.Behind);
    if (summary.files > 0 || summary.isTruncated)
      views.add(GitWorkspaceView.Changed);
    if (shown?.pullRequestState === GitPullRequestState.Open && shown.isWaitingForReview)
      views.add(GitWorkspaceView.WaitingForReview);
    return views;
  }

  public static stackedOnOf(row: GitPullRequestRow | null, list: GitPullRequestList | null | undefined): GitPullRequestRow | null {
    if (Object.isNull(row) || Object.isNull(row.baseBranch) || Object.isNullOrUndefined(list))
      return null;
    return list.rows.find(t => t.key !== row.key && t.headBranch === row.baseBranch) ?? null;
  }

  public static pullRequestTextOf(summary: GitRepositorySummary | null, shown: GitBranchPullRequest | null | undefined): string {
    if (Object.isNull(summary) || summary.isUnread)
      return "";
    if (Object.isUndefined(shown))
      return Resources.noPullRequest;
    if (!Object.isNull(shown) && !Object.isNull(shown.pullRequest) && !Object.isNull(shown.pullRequestState))
      return Resources.formatWorkspacePullRequest(shown.pullRequest.label, shown.pullRequestState, shown.isWaitingForReview, shown.stateLabel);
    switch (shown?.state) {
      case GitPullRequestsState.Ready:
        return Resources.noPullRequest;
      case GitPullRequestsState.SignedOut:
        return Resources.pullRequestSignedOut;
      case GitPullRequestsState.Failed:
        return Resources.pullRequestUnavailable;
      default:
        return "";
    }
  }

  public static countedOf(summary: GitRepositorySummary | null, shown: GitBranchPullRequest | null | undefined): GitBranchPullRequest | null {
    if (Object.isNull(summary) || summary.isUnread || Object.isNullOrUndefined(shown))
      return null;
    if (shown.state === GitPullRequestsState.Ready)
      return shown;
    return shown.state === GitPullRequestsState.Reading && (!Object.isNull(shown.pullRequest) || shown.passed + shown.failing + shown.pending > 0) ? shown : null;
  }

  public static checksOf(row: GitBranchPullRequest | null): string {
    if (Object.isNull(row))
      return "";
    if (row.failing > 0)
      return Resources.checksFailing;
    if (row.pending > 0)
      return Resources.checksRunning;
    return row.passed > 0 ? Resources.checksPassing : Resources.noChecks;
  }

  public static checksToneOf(row: GitBranchPullRequest | null): string {
    if (Object.isNull(row))
      return "";
    if (row.failing > 0)
      return "failed";
    if (row.pending > 0)
      return "pending";
    return row.passed > 0 ? "ok" : "none";
  }

  public static branchOf(summary: GitRepositorySummary | null): string {
    if (Object.isNull(summary) || summary.isUnread)
      return "";
    if (!Object.isNull(summary.branch))
      return summary.branch;
    return Object.isNull(summary.head) ? Resources.noCommitsYet : Resources.formatDetachedAt(summary.head.slice(0, 7));
  }

  public static syncOf(summary: GitRepositorySummary | null): string {
    if (Object.isNull(summary) || summary.isUnread)
      return "";
    if (Object.isNull(summary.upstream))
      return Resources.noUpstreamShort;
    return summary.gone ? Resources.upstreamGone : Resources.formatSync(summary.ahead, summary.behind);
  }

  public static fetchedOf(summary: GitRepositorySummary | null, now: Date): string {
    if (Object.isNull(summary) || summary.isUnread)
      return "";
    return Object.isNull(summary.fetchedAt) ? Resources.neverFetched : CommitLabels.ageOf(summary.fetchedAt, now);
  }

  public static changesOf(summary: GitRepositorySummary | null): string {
    if (Object.isNull(summary))
      return "";
    if (summary.isFetching)
      return Resources.fetching;
    if (summary.isUnread)
      return "";
    return summary.conflicts > 0 ? Resources.formatConflicts(summary.conflicts) : Resources.formatChangedFileCount(summary.files, summary.isTruncated);
  }
}
