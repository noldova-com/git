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
import { BranchPullRequest, CheckState, CommitQuery, HostCommitComments, type HostItem, HostPullRequestList, type HostPullRequestRow, type HostReviewRequest,
  type HostAccountList, HostReviewRequestList, ReferenceState, RepositoryQuery, ReviewDecision, SignInState } from "@noldova/git.hosting.protocol";
import type { GitRemote } from "@noldova/git.protocol";
import { GitBranchPullRequest, GitCommitComments, GitPullRequestList, GitPullRequestRow, GitPullRequestState, type IGitPullRequests } from "@noldova/git.window";

import type { IRemotePlace } from "../interfaces/i-remote-place.ts";
import { CommitRead } from "../models/commit-read.ts";
import { ListRead } from "../models/list-read.ts";
import { ReadQueue } from "../models/read-queue.ts";
import { AccountEvents } from "./account-events.ts";
import { GitHubFolders } from "./github-folders.ts";
import { SignInEvents } from "./sign-in-events.ts";
import { Resources } from "../../resources.ts";

export class GitHubPullRequests implements IGitPullRequests {
  private static readonly STATES: Readonly<Record<ReferenceState, GitPullRequestState>> = {
    [ReferenceState.Open]: GitPullRequestState.Open, [ReferenceState.Draft]: GitPullRequestState.Draft, [ReferenceState.Merged]: GitPullRequestState.Merged,
    [ReferenceState.Closed]: GitPullRequestState.Closed, [ReferenceState.ClosedDone]: GitPullRequestState.Closed,
    [ReferenceState.ClosedNotPlanned]: GitPullRequestState.Closed
  };
  private readonly lists: Map<string, WritableSignal<GitPullRequestList | null>> = new Map();
  private readonly queries: Map<string, ListRead> = new Map();
  private readonly reads: Map<string, number> = new Map();
  private readonly reviews: Map<string, WritableSignal<GitPullRequestList | null>> = new Map();
  private readonly reviewReads: Map<string, number> = new Map();
  private readonly reviewQueries: Map<string, RepositoryQuery> = new Map();
  private readonly comments: Map<string, WritableSignal<GitCommitComments | null>> = new Map();
  private readonly commentQueries: Map<string, CommitRead<GitCommitComments>> = new Map();
  private readonly commentReads: Map<string, number> = new Map();
  private readonly commits: Map<string, WritableSignal<GitBranchPullRequest | null>> = new Map();
  private readonly commitQueries: Map<string, CommitRead<GitBranchPullRequest>> = new Map();
  private readonly commitReads: Map<string, number> = new Map();
  private readonly rereads: ReadQueue = new ReadQueue(Resources.gitHubReferenceReadLimit);
  private readonly context: IWindowPartContext;
  private readonly unfollow: () => void;
  private readonly unfollowAccounts: () => void;
  private states: ReadonlyMap<number, SignInState> = new Map();

  public readonly hostName: string = Resources.hostName;
  public readonly signInPage: string = Resources.accountsPage;

  public constructor(context: IWindowPartContext) {
    this.context = context;
    this.unfollow = SignInEvents.follow(context, signIn => this.readAgain(signIn.state));
    this.unfollowAccounts = AccountEvents.follow(context, list => this.readAgainFor(list));
  }

  public stop(): void {
    this.unfollow();
    this.unfollowAccounts();
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

  public refresh(folder: string, remote: GitRemote): void {
    if (!Object.isNull(remote.host) && !Object.isNull(remote.path))
      void this.readAsync(folder, remote, new RepositoryQuery(remote.host, remote.path));
  }

  public commentsFor(folder: string, remote: GitRemote, commitId: string): Signal<GitCommitComments | null> {
    const key: string = JSON.stringify([remote.host, remote.path, commitId]);
    const known: WritableSignal<GitCommitComments | null> | undefined = this.comments.get(key);
    if (!Object.isUndefined(known))
      return known;
    const answer: WritableSignal<GitCommitComments | null> = signal<GitCommitComments | null>(null);
    this.comments.set(key, answer);
    if (!Object.isNull(remote.host) && !Object.isNull(remote.path)) {
      const query: CommitQuery = new CommitQuery(remote.host, remote.path, commitId);
      this.commentQueries.set(key, new CommitRead(folder, remote, query, answer));
      void this.readCommentsAsync(folder, remote, query, key, answer, GitHubPullRequests.claim(this.commentReads, key));
    }
    return answer;
  }

  public commitFor(folder: string, remote: GitRemote, commitId: string): Signal<GitBranchPullRequest | null> {
    const key: string = JSON.stringify([remote.host, remote.path, commitId]);
    const known: WritableSignal<GitBranchPullRequest | null> | undefined = this.commits.get(key);
    if (!Object.isUndefined(known))
      return known;
    const answer: WritableSignal<GitBranchPullRequest | null> = signal<GitBranchPullRequest | null>(null);
    this.commits.set(key, answer);
    if (!Object.isNull(remote.host) && !Object.isNull(remote.path)) {
      const query: CommitQuery = new CommitQuery(remote.host, remote.path, commitId);
      this.commitQueries.set(key, new CommitRead(folder, remote, query, answer));
      void this.readCommitAsync(folder, remote, query, key, answer, GitHubPullRequests.claim(this.commitReads, key));
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

  private readAgainFor(list: HostAccountList): void {
    const states: ReadonlyMap<number, SignInState> = new Map(list.accounts.map(t => [t.id, t.signIn.state]));
    const ids: ReadonlySet<number> = new Set([...states.keys(), ...this.states.keys()]);
    const isChanged: boolean = [...ids].some(t => t !== Resources.firstAccount && states.get(t) !== this.states.get(t) && states.get(t) !== SignInState.Waiting);
    this.states = states;
    if (isChanged)
      this.readAll();
  }

  private readAgain(state: SignInState): void {
    if (state !== SignInState.Waiting)
      this.readAll();
  }

  private readAll(): void {
    for (const read of this.queries.values())
      void this.readAsync(read.folder, read.remote, read.query);
    for (const query of this.reviewQueries.values())
      void this.readReviewsAsync(query);
    for (const [key, commit] of this.commitQueries) {
      const read: number = GitHubPullRequests.claim(this.commitReads, key);
      this.rereads.add(() => this.readCommitAsync(commit.folder, commit.remote, commit.query, key, commit.answer, read));
    }
    for (const [key, comments] of this.commentQueries) {
      const read: number = GitHubPullRequests.claim(this.commentReads, key);
      this.rereads.add(() => this.readCommentsAsync(comments.folder, comments.remote, comments.query, key, comments.answer, read));
    }
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

  private async readCommitAsync(folder: string, remote: GitRemote, query: CommitQuery, key: string, answer: WritableSignal<GitBranchPullRequest | null>,
    read: number): Promise<void> {
    try {
      await GitHubFolders.useAsync(this.context, folder, remote);
      const found = BranchPullRequest.fromJson(await this.context.requestAsync(GitHubNames.readCommitPullRequestMethod, query.toJson()));
      if (this.commitReads.get(key) === read)
        answer.set(GitHubPullRequests.commitAnswerOf(found));
    }
    catch (error) {
      if (!(error instanceof WindowException))
        throw error;
      this.context.log(Resources.formatRequestFailed(GitHubNames.readCommitPullRequestMethod, String(error)));
      if (this.commitReads.get(key) !== read)
        return;
      this.commits.delete(key);
      this.commitQueries.delete(key);
      answer.set(GitBranchPullRequest.failed(error instanceof RuntimeRequestException ? error.message : Resources.commitPullRequestUnanswered));
    }
  }

  private async readCommentsAsync(folder: string, remote: GitRemote, query: CommitQuery, key: string, answer: WritableSignal<GitCommitComments | null>,
    read: number): Promise<void> {
    try {
      await GitHubFolders.useAsync(this.context, folder, remote);
      const found = HostCommitComments.fromJson(await this.context.requestAsync(GitHubNames.readCommitCommentsMethod, query.toJson()));
      if (this.commentReads.get(key) === read)
        answer.set(new GitCommitComments(found.count, found.isCapped, found.url));
    }
    catch (error) {
      if (!(error instanceof WindowException))
        throw error;
      this.context.log(Resources.formatRequestFailed(GitHubNames.readCommitCommentsMethod, String(error)));
      if (this.commentReads.get(key) === read) {
        this.comments.delete(key);
        this.commentQueries.delete(key);
      }
    }
  }

  private static claim(reads: Map<string, number>, key: string): number {
    const read: number = (reads.get(key) ?? 0) + 1;
    reads.set(key, read);
    return read;
  }

  private static listIn(lists: Map<string, WritableSignal<GitPullRequestList | null>>, key: string): WritableSignal<GitPullRequestList | null> {
    let list = lists.get(key);
    if (Object.isUndefined(list)) {
      list = signal<GitPullRequestList | null>(null);
      lists.set(key, list);
    }
    return list;
  }

  private static commitAnswerOf(found: BranchPullRequest): GitBranchPullRequest {
    const item: HostItem | null = found.pullRequest;
    if (Object.isNull(item) || Object.isNull(item.changes))
      return GitBranchPullRequest.none(0, 0, 0);
    const count = (...states: readonly CheckState[]): number => found.checks.filter(t => states.includes(t.state)).length;
    const row: GitPullRequestRow = new GitPullRequestRow(item.reference.text, Resources.formatPullRequestLabel(item.reference.number), item.title, item.url,
      item.state === ReferenceState.Draft, found.approvals ?? 0, count(CheckState.Succeeded), count(CheckState.Failed), count(CheckState.Queued, CheckState.Running),
      "", item.changes.baseBranch);
    return GitBranchPullRequest.of(row, GitHubPullRequests.STATES[item.state], item.state === ReferenceState.Open && found.reviewDecision === ReviewDecision.Waiting);
  }

  private static reviewRowOf(request: HostReviewRequest): GitPullRequestRow {
    return new GitPullRequestRow(request.reference.text, Resources.formatPullRequestLabel(request.reference.number), request.title, request.url, request.isDraft, 0,
      0, 0, 0, "", null, request.account);
  }

  private async readAsync(folder: string, remote: GitRemote, query: RepositoryQuery): Promise<void> {
    const key: string = GitHubPullRequests.keyOf(query);
    const list = this.listOf(key);
    this.queries.set(key, new ListRead(folder, remote, query));
    const read: number = (this.reads.get(key) ?? 0) + 1;
    this.reads.set(key, read);
    list.set(GitPullRequestList.reading(list()?.rows ?? []));
    try {
      await GitHubFolders.useAsync(this.context, folder, remote);
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
