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
import { AzureDevOpsNames } from "@noldova/git.azure-devops.protocol";
import { BranchPullRequest, BranchQuery, CheckState, CommitQuery, HostCommitComments, type HostItem, type HostPullRequestHead, HostPullRequestHeads,
  HostPullRequestList, type HostPullRequestRow, type HostReference,
  type HostReviewRequest, HostReviewRequestList, HostSignIn, ReferenceState, RepositoryQuery, ReviewDecision, SignInState } from "@noldova/git.hosting.protocol";
import type { GitRemote } from "@noldova/git.protocol";
import { GitBranchPullRequest, GitCommitComments, GitPullRequestList, GitPullRequestRow, GitPullRequestState, type IGitPullRequests } from "@noldova/git.window";

import type { IRemotePlace } from "../interfaces/i-remote-place.ts";
import { AzureDevOpsRemote } from "../models/azure-devops-remote.ts";
import { PullRequestClone } from "../models/pull-request-clone.ts";
import { PullRequestDocument } from "../models/pull-request-document.ts";
import { WorkItemsPlace } from "../models/work-items-place.ts";
import { Resources } from "../../resources.ts";
import { PullRequestPages } from "./pull-request-pages.ts";

export class AzureDevOpsPullRequests implements IGitPullRequests {
  private static readonly STATES: Readonly<Record<ReferenceState, GitPullRequestState>> = {
    [ReferenceState.Open]: GitPullRequestState.Open, [ReferenceState.Draft]: GitPullRequestState.Draft, [ReferenceState.Merged]: GitPullRequestState.Merged,
    [ReferenceState.Closed]: GitPullRequestState.Closed, [ReferenceState.ClosedDone]: GitPullRequestState.Closed,
    [ReferenceState.ClosedNotPlanned]: GitPullRequestState.Closed
  };
  private readonly lists: Map<string, WritableSignal<GitPullRequestList | null>> = new Map();
  private readonly reads: Map<string, number> = new Map();
  private readonly reviews: Map<string, WritableSignal<GitPullRequestList | null>> = new Map();
  private readonly reviewReads: Map<string, number> = new Map();
  private readonly branches: Map<string, WritableSignal<GitBranchPullRequest | null>> = new Map();
  private readonly commits: Map<string, WritableSignal<GitBranchPullRequest | null>> = new Map();
  private readonly comments: Map<string, WritableSignal<GitCommitComments | null>> = new Map();
  private readonly stacks: Map<string, WritableSignal<GitPullRequestList | null>> = new Map();
  private readonly context: IWindowPartContext;
  private readonly remember: (url: string, reference: HostReference) => void;

  public readonly hostName: string = Resources.hostName;
  public readonly signInPage: string = Resources.accountsPage;

  public constructor(context: IWindowPartContext, remember: (url: string, reference: HostReference) => void) {
    this.context = context;
    this.remember = remember;
  }

  public claims(remote: GitRemote): boolean {
    return AzureDevOpsRemote.isAzureDevOps(remote);
  }

  public newPullRequestUrl(remote: GitRemote, source: string, target: string): string | null {
    const place: WorkItemsPlace | null = WorkItemsPlace.ofRemote(remote);
    const repository: string | null = PullRequestClone.repositoryOf(remote);
    return Object.isNull(place) || Object.isNull(repository) ? null : Resources.formatNewPullRequestAddress(place.organization, place.project, repository, source, target);
  }

  public listFor(_folder: string, remote: GitRemote): Signal<GitPullRequestList | null> {
    return this.listOf(AzureDevOpsPullRequests.keyOf(remote));
  }

  public refresh(_folder: string, remote: GitRemote): void {
    const path: string | null = AzureDevOpsRemote.pathOf(remote);
    if (!Object.isNull(remote.host) && !Object.isNull(path))
      void this.readAsync(new RepositoryQuery(remote.host, path));
  }

  public branchFor(_folder: string, remote: GitRemote, branch: string, headCommit: string | null): Signal<GitBranchPullRequest | null> {
    return AzureDevOpsPullRequests.answerOf(this.branches, AzureDevOpsPullRequests.branchKeyOf(remote, branch, headCommit));
  }

  public refreshBranch(_folder: string, remote: GitRemote, branch: string, headCommit: string | null): void {
    const path: string | null = AzureDevOpsRemote.pathOf(remote);
    if (!Object.isNull(remote.host) && !Object.isNull(path))
      void this.readBranchAsync(new BranchQuery(remote.host, path, branch, headCommit));
  }

  public stackListFor(_folder: string, remote: GitRemote): Signal<GitPullRequestList | null> {
    const key: string = AzureDevOpsPullRequests.keyOf(remote);
    const known: WritableSignal<GitPullRequestList | null> | undefined = this.stacks.get(key);
    if (!Object.isUndefined(known))
      return known;
    const answer: WritableSignal<GitPullRequestList | null> = signal<GitPullRequestList | null>(null);
    this.stacks.set(key, answer);
    const path: string | null = AzureDevOpsRemote.pathOf(remote);
    if (!Object.isNull(remote.host) && !Object.isNull(path))
      void this.readStacksAsync(new RepositoryQuery(remote.host, path), key, answer);
    return answer;
  }

  public commitFor(_folder: string, remote: GitRemote, commitId: string): Signal<GitBranchPullRequest | null> {
    const key: string = JSON.stringify([remote.host, remote.path, commitId]);
    const known: WritableSignal<GitBranchPullRequest | null> | undefined = this.commits.get(key);
    if (!Object.isUndefined(known))
      return known;
    const answer: WritableSignal<GitBranchPullRequest | null> = AzureDevOpsPullRequests.answerOf(this.commits, key);
    const path: string | null = AzureDevOpsRemote.pathOf(remote);
    if (!Object.isNull(remote.host) && !Object.isNull(path))
      void this.readCommitAsync(new CommitQuery(remote.host, path, commitId), key, answer);
    return answer;
  }

  public commentsFor(_folder: string, remote: GitRemote, commitId: string): Signal<GitCommitComments | null> {
    const key: string = JSON.stringify([remote.host, remote.path, commitId]);
    const known: WritableSignal<GitCommitComments | null> | undefined = this.comments.get(key);
    if (!Object.isUndefined(known))
      return known;
    const answer: WritableSignal<GitCommitComments | null> = signal<GitCommitComments | null>(null);
    this.comments.set(key, answer);
    const path: string | null = AzureDevOpsRemote.pathOf(remote);
    if (!Object.isNull(remote.host) && !Object.isNull(path))
      void this.readCommentsAsync(new CommitQuery(remote.host, path, commitId), key, answer);
    return answer;
  }

  public reviewsFor(remote: GitRemote): Signal<GitPullRequestList | null> {
    return AzureDevOpsPullRequests.listIn(this.reviews, AzureDevOpsPullRequests.keyOf(remote));
  }

  public refreshReviews(remote: GitRemote): void {
    const path: string | null = AzureDevOpsRemote.pathOf(remote);
    if (!Object.isNull(remote.host) && !Object.isNull(path))
      void this.readReviewsAsync(new RepositoryQuery(remote.host, path));
  }

  public isShown(_folder: string, row: GitPullRequestRow): boolean {
    return PullRequestPages.isActive(row.key);
  }

  public open(_folder: string, row: GitPullRequestRow): boolean {
    if (Object.isNull(PullRequestDocument.referenceOf(row.key)))
      return false;
    this.context.openDocument(Resources.pullRequestDocument, row.key, Resources.formatDocumentTitle(row.label, row.title));
    return true;
  }

  private listOf(key: string): WritableSignal<GitPullRequestList | null> {
    return AzureDevOpsPullRequests.listIn(this.lists, key);
  }

  private async readReviewsAsync(query: RepositoryQuery): Promise<void> {
    const key: string = AzureDevOpsPullRequests.keyOf(query);
    const list = AzureDevOpsPullRequests.listIn(this.reviews, key);
    const read: number = (this.reviewReads.get(key) ?? 0) + 1;
    this.reviewReads.set(key, read);
    const shown: readonly GitPullRequestRow[] = list()?.rows ?? [];
    list.set(GitPullRequestList.reading(shown));
    try {
      const answer = HostReviewRequestList.fromJson(await this.context.requestAsync(AzureDevOpsNames.readReviewRequestsMethod, query.toJson()));
      if (this.reviewReads.get(key) === read)
        list.set(answer.isSignedIn ? GitPullRequestList.ready(answer.rows.map(t => this.reviewRowOf(t)), answer.hasMore)
          : GitPullRequestList.signedOut());
    }
    catch (error) {
      if (!(error instanceof WindowException))
        throw error;
      this.context.log(Resources.formatRequestFailed(AzureDevOpsNames.readReviewRequestsMethod, String(error)));
      if (this.reviewReads.get(key) === read)
        list.set(GitPullRequestList.failed(error instanceof RuntimeRequestException ? error.message : Resources.pullRequestsUnanswered, shown));
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

  private reviewRowOf(request: HostReviewRequest): GitPullRequestRow {
    this.remember(request.url, request.reference);
    return new GitPullRequestRow(PullRequestDocument.instanceOf(request.reference), Resources.formatPullRequestReference(request.reference.number), request.title,
      request.url, request.isDraft, 0, 0, 0, 0, "");
  }

  private async readAsync(query: RepositoryQuery): Promise<void> {
    const key: string = AzureDevOpsPullRequests.keyOf(query);
    const list = this.listOf(key);
    const read: number = (this.reads.get(key) ?? 0) + 1;
    this.reads.set(key, read);
    list.set(GitPullRequestList.reading(list()?.rows ?? []));
    try {
      const answer = HostPullRequestList.fromJson(await this.context.requestAsync(AzureDevOpsNames.readPullRequestsMethod, query.toJson()));
      if (this.reads.get(key) === read)
        list.set(answer.isSignedIn ? GitPullRequestList.ready(answer.rows.map(t => this.rowOf(t))) : GitPullRequestList.signedOut());
    }
    catch (error) {
      if (!(error instanceof WindowException))
        throw error;
      this.context.log(Resources.formatRequestFailed(AzureDevOpsNames.readPullRequestsMethod, String(error)));
      if (this.reads.get(key) === read)
        list.set(GitPullRequestList.failed(error instanceof RuntimeRequestException ? error.message : Resources.pullRequestsUnanswered));
    }
  }

  private async readBranchAsync(query: BranchQuery): Promise<void> {
    const key: string = AzureDevOpsPullRequests.branchKeyOf(query, query.branch, query.headCommit);
    const answer: WritableSignal<GitBranchPullRequest | null> = AzureDevOpsPullRequests.answerOf(this.branches, key);
    const read: number = (this.reads.get(key) ?? 0) + 1;
    this.reads.set(key, read);
    answer.set(GitBranchPullRequest.reading(answer()));
    try {
      const [signIn, found] = await Promise.all([this.context.requestAsync(AzureDevOpsNames.readSignInMethod, null),
        this.context.requestAsync(AzureDevOpsNames.readBranchPullRequestMethod, query.toJson())]);
      const shown: GitBranchPullRequest = HostSignIn.fromJson(signIn).state === SignInState.SignedIn
        ? this.branchAnswerOf(BranchPullRequest.fromJson(found), query.branch) : GitBranchPullRequest.signedOut();
      if (this.reads.get(key) === read)
        answer.set(shown);
    }
    catch (error) {
      if (!(error instanceof WindowException))
        throw error;
      this.context.log(Resources.formatRequestFailed(AzureDevOpsNames.readBranchPullRequestMethod, String(error)));
      if (this.reads.get(key) === read)
        answer.set(GitBranchPullRequest.failed(error instanceof RuntimeRequestException ? error.message : Resources.branchPullRequestUnanswered));
    }
  }

  private async readCommitAsync(query: CommitQuery, key: string, answer: WritableSignal<GitBranchPullRequest | null>): Promise<void> {
    try {
      answer.set(this.branchAnswerOf(BranchPullRequest.fromJson(await this.context.requestAsync(AzureDevOpsNames.readCommitPullRequestMethod,
        query.toJson())), ""));
    }
    catch (error) {
      if (!(error instanceof WindowException))
        throw error;
      this.context.log(Resources.formatRequestFailed(AzureDevOpsNames.readCommitPullRequestMethod, String(error)));
      this.commits.delete(key);
      answer.set(GitBranchPullRequest.failed(error instanceof RuntimeRequestException ? error.message : Resources.commitPullRequestUnanswered));
    }
  }

  private async readStacksAsync(query: RepositoryQuery, key: string, answer: WritableSignal<GitPullRequestList | null>): Promise<void> {
    try {
      const found = HostPullRequestHeads.fromJson(await this.context.requestAsync(AzureDevOpsNames.readPullRequestHeadsMethod, query.toJson()));
      answer.set(found.isSignedIn ? GitPullRequestList.ready(found.rows.map(t => this.headRowOf(t)), found.hasMore) : GitPullRequestList.signedOut());
    }
    catch (error) {
      if (!(error instanceof WindowException))
        throw error;
      this.context.log(Resources.formatRequestFailed(AzureDevOpsNames.readPullRequestHeadsMethod, String(error)));
      this.stacks.delete(key);
    }
  }

  private async readCommentsAsync(query: CommitQuery, key: string, answer: WritableSignal<GitCommitComments | null>): Promise<void> {
    try {
      const found = HostCommitComments.fromJson(await this.context.requestAsync(AzureDevOpsNames.readCommitCommentsMethod, query.toJson()));
      answer.set(new GitCommitComments(found.count, found.isCapped, found.url));
    }
    catch (error) {
      if (!(error instanceof WindowException))
        throw error;
      this.context.log(Resources.formatRequestFailed(AzureDevOpsNames.readCommitCommentsMethod, String(error)));
      this.comments.delete(key);
    }
  }

  private branchAnswerOf(found: BranchPullRequest, headBranch: string): GitBranchPullRequest {
    const item: HostItem | null = found.pullRequest;
    if (Object.isNull(item) || Object.isNull(item.changes))
      return GitBranchPullRequest.none(0, 0, 0);
    this.remember(item.url, item.reference);
    const count = (...states: readonly CheckState[]): number => found.checks.filter(t => states.includes(t.state)).length;
    const row: GitPullRequestRow = new GitPullRequestRow(PullRequestDocument.instanceOf(item.reference), Resources.formatPullRequestReference(item.reference.number),
      item.title, item.url, item.state === ReferenceState.Draft, found.approvals ?? 0, count(CheckState.Succeeded), count(CheckState.Failed),
      count(CheckState.Queued, CheckState.Running), headBranch, item.changes.baseBranch);
    return GitBranchPullRequest.of(row, AzureDevOpsPullRequests.STATES[item.state], item.state === ReferenceState.Open && found.reviewDecision === ReviewDecision.Waiting,
      Resources.stateLabels[item.state]);
  }

  private static answerOf(answers: Map<string, WritableSignal<GitBranchPullRequest | null>>, key: string): WritableSignal<GitBranchPullRequest | null> {
    let answer = answers.get(key);
    if (Object.isUndefined(answer)) {
      answer = signal<GitBranchPullRequest | null>(null);
      answers.set(key, answer);
    }
    return answer;
  }

  private static branchKeyOf(remote: IRemotePlace, branch: string, headCommit: string | null): string {
    return JSON.stringify([remote.host, remote.path, branch, headCommit]);
  }

  private rowOf(row: HostPullRequestRow): GitPullRequestRow {
    this.remember(row.url, row.reference);
    return new GitPullRequestRow(PullRequestDocument.instanceOf(row.reference), Resources.formatPullRequestReference(row.reference.number), row.title,
      row.url, row.isDraft, row.approvals, row.passed, row.failing, row.pending, row.headBranch, row.baseBranch);
  }

  private headRowOf(head: HostPullRequestHead): GitPullRequestRow {
    this.remember(head.url, head.reference);
    return new GitPullRequestRow(PullRequestDocument.instanceOf(head.reference), Resources.formatPullRequestReference(head.reference.number), head.title,
      head.url, false, 0, 0, 0, 0, head.headBranch, head.baseBranch);
  }

  private static keyOf(remote: IRemotePlace): string {
    return Resources.formatRemoteKey(remote.host ?? "", remote.path ?? "");
  }
}
