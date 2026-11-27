/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { type Signal, signal, type WritableSignal } from "@angular/core";
import "@noldova/context.core";
import { type IWindowPartContext, RuntimeRequestException, WindowException } from "@noldova/desktop.window";
import { GitHubNames } from "@noldova/git.github.protocol";
import { CommitQuery, HostCommitComments, HostPullRequestList, type HostPullRequestRow, type HostReviewRequest, HostReviewRequestList,
  RepositoryQuery, SignInState } from "@noldova/git.hosting.protocol";
import type { GitRemote } from "@noldova/git.protocol";
import { GitCommitComments, GitPullRequestList, GitPullRequestRow, type IGitPullRequests } from "@noldova/git.window";

import type { IRemotePlace } from "../interfaces/i-remote-place.ts";
import { SignInEvents } from "./sign-in-events.ts";
import { Resources } from "../../resources.ts";

export class GitHubPullRequests implements IGitPullRequests {
  private readonly lists: Map<string, WritableSignal<GitPullRequestList | null>> = new Map();
  private readonly queries: Map<string, RepositoryQuery> = new Map();
  private readonly reads: Map<string, number> = new Map();
  private readonly reviews: Map<string, WritableSignal<GitPullRequestList | null>> = new Map();
  private readonly reviewReads: Map<string, number> = new Map();
  private readonly reviewQueries: Map<string, RepositoryQuery> = new Map();
  private readonly comments: Map<string, WritableSignal<GitCommitComments | null>> = new Map();
  private readonly commentQueries: Map<string, [CommitQuery, WritableSignal<GitCommitComments | null>]> = new Map();
  private readonly context: IWindowPartContext;
  private readonly unfollow: () => void;

  public readonly hostName: string = Resources.hostName;
  public readonly signInPage: string = Resources.accountsPage;

  public constructor(context: IWindowPartContext) {
    this.context = context;
    this.unfollow = SignInEvents.follow(context, signIn => this.readAgain(signIn.state));
  }

  public stop(): void {
    this.unfollow();
  }

  public claims(remote: GitRemote): boolean {
    return remote.host === Resources.gitHubHost;
  }

  public newPullRequestUrl(remote: GitRemote, source: string, target: string): string | null {
    return Object.isNull(remote.path) ? null : Resources.formatGitHubNewPullRequestAddress(remote.path, source, target);
  }

  public listFor(_folder: string, remote: GitRemote): Signal<GitPullRequestList | null> {
    return this.listOf(GitHubPullRequests.keyOf(remote));
  }

  public refresh(_folder: string, remote: GitRemote): void {
    if (!Object.isNull(remote.host) && !Object.isNull(remote.path))
      void this.readAsync(new RepositoryQuery(remote.host, remote.path));
  }

  public commentsFor(_folder: string, remote: GitRemote, commitId: string): Signal<GitCommitComments | null> {
    const key: string = JSON.stringify([remote.host, remote.path, commitId]);
    const known: WritableSignal<GitCommitComments | null> | undefined = this.comments.get(key);
    if (!Object.isUndefined(known))
      return known;
    const answer: WritableSignal<GitCommitComments | null> = signal<GitCommitComments | null>(null);
    this.comments.set(key, answer);
    if (!Object.isNull(remote.host) && !Object.isNull(remote.path)) {
      const query: CommitQuery = new CommitQuery(remote.host, remote.path, commitId);
      this.commentQueries.set(key, [query, answer]);
      void this.readCommentsAsync(query, key, answer);
    }
    return answer;
  }

  public reviewsFor(remote: GitRemote): Signal<GitPullRequestList | null> {
    return GitHubPullRequests.listIn(this.reviews, GitHubPullRequests.keyOf(remote));
  }

  public refreshReviews(remote: GitRemote): void {
    if (!Object.isNull(remote.host) && !Object.isNull(remote.path))
      void this.readReviewsAsync(new RepositoryQuery(remote.host, remote.path));
  }

  private readAgain(state: SignInState): void {
    if (state === SignInState.Waiting)
      return;
    for (const query of this.queries.values())
      void this.readAsync(query);
    for (const query of this.reviewQueries.values())
      void this.readReviewsAsync(query);
    for (const [key, [query, answer]] of this.commentQueries)
      void this.readCommentsAsync(query, key, answer);
  }

  private listOf(key: string): WritableSignal<GitPullRequestList | null> {
    return GitHubPullRequests.listIn(this.lists, key);
  }

  private async readReviewsAsync(query: RepositoryQuery): Promise<void> {
    const key: string = GitHubPullRequests.keyOf(query);
    const list = GitHubPullRequests.listIn(this.reviews, key);
    this.reviewQueries.set(key, query);
    const read: number = (this.reviewReads.get(key) ?? 0) + 1;
    this.reviewReads.set(key, read);
    const shown: readonly GitPullRequestRow[] = list()?.rows ?? [];
    list.set(GitPullRequestList.reading(shown));
    try {
      const answer = HostReviewRequestList.fromJson(await this.context.requestAsync(GitHubNames.readReviewRequestsMethod, query.toJson()));
      if (this.reviewReads.get(key) === read)
        list.set(answer.isSignedIn ? GitPullRequestList.ready(answer.rows.map(GitHubPullRequests.reviewRowOf), answer.hasMore) : GitPullRequestList.signedOut());
    }
    catch (error) {
      if (!(error instanceof WindowException))
        throw error;
      this.context.log(Resources.formatRequestFailed(GitHubNames.readReviewRequestsMethod, String(error)));
      if (this.reviewReads.get(key) === read)
        list.set(GitPullRequestList.failed(error instanceof RuntimeRequestException ? error.message : Resources.pullRequestsUnanswered, shown));
    }
  }

  private async readCommentsAsync(query: CommitQuery, key: string, answer: WritableSignal<GitCommitComments | null>): Promise<void> {
    try {
      const found = HostCommitComments.fromJson(await this.context.requestAsync(GitHubNames.readCommitCommentsMethod, query.toJson()));
      answer.set(new GitCommitComments(found.count, found.isCapped, found.url));
    }
    catch (error) {
      if (!(error instanceof WindowException))
        throw error;
      this.context.log(Resources.formatRequestFailed(GitHubNames.readCommitCommentsMethod, String(error)));
      this.comments.delete(key);
      this.commentQueries.delete(key);
    }
  }

  private static listIn(lists: Map<string, WritableSignal<GitPullRequestList | null>>, key: string): WritableSignal<GitPullRequestList | null> {
    let list = lists.get(key);
    if (Object.isUndefined(list)) {
      list = signal<GitPullRequestList | null>(null);
      lists.set(key, list);
    }
    return list;
  }

  private static reviewRowOf(request: HostReviewRequest): GitPullRequestRow {
    return new GitPullRequestRow(request.reference.text, Resources.formatPullRequestLabel(request.reference.number), request.title, request.url, request.isDraft, 0,
      0, 0, 0, "");
  }

  private async readAsync(query: RepositoryQuery): Promise<void> {
    const key: string = GitHubPullRequests.keyOf(query);
    const list = this.listOf(key);
    this.queries.set(key, query);
    const read: number = (this.reads.get(key) ?? 0) + 1;
    this.reads.set(key, read);
    list.set(GitPullRequestList.reading(list()?.rows ?? []));
    try {
      const answer = HostPullRequestList.fromJson(await this.context.requestAsync(GitHubNames.readPullRequestsMethod, query.toJson()));
      if (this.reads.get(key) === read)
        list.set(answer.isSignedIn ? GitPullRequestList.ready(answer.rows.map(GitHubPullRequests.rowOf)) : GitPullRequestList.signedOut());
    }
    catch (error) {
      if (!(error instanceof WindowException))
        throw error;
      this.context.log(Resources.formatRequestFailed(GitHubNames.readPullRequestsMethod, String(error)));
      if (this.reads.get(key) === read)
        list.set(GitPullRequestList.failed(error instanceof RuntimeRequestException ? error.message : Resources.pullRequestsUnanswered));
    }
  }

  private static rowOf(row: HostPullRequestRow): GitPullRequestRow {
    return new GitPullRequestRow(row.reference.text, Resources.formatPullRequestLabel(row.reference.number), row.title, row.url, row.isDraft, row.approvals,
      row.passed, row.failing, row.pending, row.headBranch, row.baseBranch);
  }

  private static keyOf(remote: IRemotePlace): string {
    return Resources.formatRemoteKey(remote.host ?? "", remote.path ?? "");
  }
}
