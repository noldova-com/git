/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { JsonReader } from "@noldova/context.json";
import { FailureCode } from "@noldova/desktop.protocol";
import { type AuthorQuery, BranchPullRequest, type BranchQuery, CheckState, type CommitQuery, HostBuild, HostChanges, HostCheck, HostComment, HostCommitComments, HostItem,
  HostPerson, HostPullRequest, HostPullRequestList, HostPullRequestRow, HostPullRequestThreads, HostReference, HostReviewer, HostReviewRequest, HostReviewRequestList, HostThread,
  type PullRequestDraft, ReferenceKind, ReferenceState, type RepositoryQuery, ReviewDecision, ThreadStatus } from "@noldova/git.hosting.protocol";
import { GitHubNames } from "@noldova/git.github.protocol";

import type { IGitHubTokens } from "../interfaces/i-github-tokens.ts";
import { AccountSearch } from "../models/account-search.ts";
import { GitHubRepository } from "../models/github-repository.ts";
import { NewestItems } from "../models/newest-items.ts";
import { ReviewSearchAnswer } from "../models/review-search-answer.ts";
import { ReviewSearch } from "../models/review-search.ts";
import { ReviewVerdict } from "../models/review-verdict.ts";
import type { SignedInAccount } from "../models/signed-in-account.ts";
import { Resources } from "../resources.ts";
import { GitHubApi } from "./github-api.ts";
import type { GitHubAvatars } from "./github-avatars.ts";

export class GitHubReads {
  private readonly api: GitHubApi;
  private readonly tokens: IGitHubTokens;
  private readonly avatars: GitHubAvatars;
  private readonly reviewSearches: Map<string, ReviewSearch> = new Map();

  public constructor(api: GitHubApi, tokens: IGitHubTokens, avatars: GitHubAvatars) {
    this.api = api;
    this.tokens = tokens;
    this.avatars = avatars;
  }

  public readReferenceAsync(reference: HostReference, signal: AbortSignal): Promise<HostItem | null> {
    return this.readItemAsync(reference, signal, false);
  }

  public readShownReferenceAsync(reference: HostReference, signal: AbortSignal): Promise<HostItem | null> {
    return this.readItemAsync(reference, signal, true);
  }

  public async readBranchPullRequestAsync(query: BranchQuery, signal: AbortSignal): Promise<BranchPullRequest> {
    const none: BranchPullRequest = new BranchPullRequest(null, []);
    const token: string | null = await this.tokens.tokenForAsync(query.host, query.path, signal);
    const repository: GitHubRepository | null = GitHubRepository.parse(query.path);
    if (query.host !== Resources.host || token === null || repository === null)
      return none;
    const answer: BranchPullRequest = await this.askAsync(token, async () => {
      const head: string = encodeURIComponent(Resources.formatHeadFilter(repository.owner, query.branch));
      const list: JsonReader | null = await this.api.getAsync(repository.pathOf(Resources.formatBranchPullsPath(head)), token, signal);
      const first: JsonReader | undefined = list === null ? undefined : GitHubApi.read(() => list.readObjectArray(Resources.itemsField))[0];
      if (first === undefined)
        return none;
      return await this.readPullAnswerAsync(repository, GitHubApi.read(() => first.readInteger(Resources.numberField)), query.headCommit, token, signal);
    });
    return this.tokens.holds(token) ? answer : none;
  }

  public async readCommitPullRequestAsync(query: CommitQuery, signal: AbortSignal): Promise<BranchPullRequest> {
    const none: BranchPullRequest = new BranchPullRequest(null, []);
    const token: string | null = await this.tokens.tokenForAsync(query.host, query.path, signal);
    const repository: GitHubRepository | null = GitHubRepository.parse(query.path);
    if (query.host !== Resources.host || token === null || repository === null)
      return none;
    const answer: BranchPullRequest = await this.askAsync(token, async () => {
      const list: JsonReader | null = await this.api.getAsync(repository.pathOf(Resources.formatCommitPullRequestsPath(query.commit)), token, signal);
      const pulls: readonly JsonReader[] = list === null ? [] : GitHubApi.read(() => list.readObjectArray(Resources.itemsField));
      const chosen: number | null = GitHubApi.read(() => GitHubReads.bringerOf(pulls));
      return chosen === null ? none : await this.readPullAnswerAsync(repository, chosen, null, token, signal);
    });
    return this.tokens.holds(token) ? answer : none;
  }

  public async readPullRequestsAsync(query: RepositoryQuery, signal: AbortSignal): Promise<HostPullRequestList> {
    const none: HostPullRequestList = new HostPullRequestList([], false);
    const token: string | null = await this.tokens.tokenForAsync(query.host, query.path, signal);
    const repository: GitHubRepository | null = GitHubRepository.parse(query.path);
    if (token === null)
      return HostPullRequestList.signedOut();
    if (query.host !== Resources.host || repository === null)
      return none;
    const list: HostPullRequestList = await this.askAsync(token, async () => {
      const pulls: JsonReader | null = await this.api.getAsync(repository.pathOf(Resources.openPullsPath), token, signal);
      const read: readonly JsonReader[] = pulls === null ? [] : GitHubApi.read(() => pulls.readObjectArray(Resources.itemsField));
      const rows: HostPullRequestRow[] = await Promise.all(read.slice(0, HostPullRequestList.maximumRows).map(t => this.readRowAsync(repository, t, token, signal)));
      return new HostPullRequestList(rows, read.length > HostPullRequestList.maximumRows);
    });
    return this.tokens.holds(token) ? list : HostPullRequestList.signedOut();
  }

  public async readReviewRequestsAsync(query: RepositoryQuery, signal: AbortSignal): Promise<HostReviewRequestList> {
    const accounts: readonly SignedInAccount[] = this.tokens.signedIn;
    const repository: GitHubRepository | null = GitHubRepository.parse(query.path);
    if (accounts.length === 0)
      return HostReviewRequestList.signedOut();
    if (query.host !== Resources.host || repository === null)
      return new HostReviewRequestList([], false);
    const searches: readonly AccountSearch[] = await Promise.all(accounts.map(async t => new AccountSearch(t, await this.searchReviewRequestsAsync(t.token))));
    signal.throwIfAborted();
    const held: readonly AccountSearch[] = searches.filter(t => this.tokens.holds(t.account.token));
    if (held.length === 0)
      return HostReviewRequestList.signedOut();
    const key: string = GitHubReads.repositoryKeyOf(repository.owner, repository.name);
    const rows: readonly HostReviewRequest[] = held.flatMap(({ account, answer }) => answer.rows
      .filter(t => GitHubReads.repositoryKeyOf(t.reference.owner, t.reference.repository) === key)
      .map(t => accounts.length === 1 ? t : new HostReviewRequest(t.reference, t.title, t.url, t.isDraft, t.createdAt, account.login)))
      .toSorted((a, b) => b.createdAt - a.createdAt);
    return new HostReviewRequestList(rows.slice(0, HostReviewRequestList.maximumRows),
      rows.length > HostReviewRequestList.maximumRows || held.some(t => t.answer.isCut));
  }

  public async readCommitCommentsAsync(query: CommitQuery, signal: AbortSignal): Promise<HostCommitComments> {
    const none: HostCommitComments = HostCommitComments.none();
    const token: string | null = await this.tokens.tokenForAsync(query.host, query.path, signal);
    const repository: GitHubRepository | null = GitHubRepository.parse(query.path);
    if (query.host !== Resources.host || token === null || repository === null)
      return none;
    const answer: HostCommitComments = await this.askAsync(token, async () => {
      const [own, pulls] = await Promise.all([this.api.getAsync(repository.pathOf(Resources.formatCommitCommentsPath(query.commit)), token, signal),
        this.api.getAsync(repository.pathOf(Resources.formatCommitPullRequestsPath(query.commit)), token, signal)]);
      const commitComments: readonly JsonReader[] = own === null ? [] : GitHubApi.read(() => own.readObjectArray(Resources.itemsField));
      const number: number | null = pulls === null ? null : GitHubApi.read(() => GitHubReads.bringerOf(pulls.readObjectArray(Resources.itemsField)));
      const reviews: JsonReader | null = number === null ? null : await this.api.getAsync(repository.pathOf(Resources.formatPullCommentsPath(number)), token, signal);
      const reviewComments: readonly JsonReader[] = reviews === null ? [] : GitHubApi.read(() => reviews.readObjectArray(Resources.itemsField));
      return GitHubApi.read(() => GitHubReads.commitCommentsOf(query.commit, commitComments, reviewComments));
    });
    return this.tokens.holds(token) ? answer : none;
  }

  public async readAuthorAvatarAsync(query: AuthorQuery, signal: AbortSignal): Promise<string | null> {
    if (query.host !== Resources.host)
      return null;
    const email: string = query.email.trim().toLowerCase();
    if (Resources.noReplyPattern.test(email))
      return this.avatars.readAsync(email.replace(Resources.noReplyPattern, (_email, id: string | undefined, login: string) => Resources.formatAccountAvatar(id ?? null, login)),
        signal);
    const token: string | null = await this.tokens.tokenForAsync(query.host, query.path, signal);
    const repository: GitHubRepository | null = GitHubRepository.parse(query.path);
    if (token === null || repository === null)
      return null;
    const address: string | null = await this.askAsync(token, async () => {
      const commit: JsonReader | null = await this.api.getAsync(repository.pathOf(Resources.formatCommitPath(query.commit)), token, signal);
      return commit === null ? null : GitHubApi.read(() => commit.readNullableObject(Resources.authorField)?.readNullableString(Resources.avatarUrlField) ?? null);
    });
    const avatar: string | null = await this.avatars.readAsync(address, signal);
    return this.tokens.holds(token) ? avatar : null;
  }

  public async readPullRequestAsync(reference: HostReference, signal: AbortSignal): Promise<HostPullRequest | null> {
    const token: string | null = reference.host === GitHubNames.moduleId
      ? await this.tokens.tokenForAsync(Resources.host, Resources.formatRepositoryName(reference.owner, reference.repository), signal) : null;
    const repository: GitHubRepository | null = GitHubRepository.parse(Resources.formatRepositoryName(reference.owner, reference.repository));
    if (reference.host !== GitHubNames.moduleId || token === null || repository === null)
      return null;
    const pullRequest: HostPullRequest | null = await this.askAsync(token, async () => {
      const pull: JsonReader | null = await this.api.getAsync(repository.pathOf(Resources.formatPullPath(reference.number)), token, signal);
      if (pull === null)
        return null;
      const commit: string = GitHubApi.read(() => pull.readObject(Resources.headField).readString(Resources.shaField));
      const [avatar, reviews, runs] = await Promise.all([this.avatars.readAsync(GitHubApi.read(() => GitHubReads.avatarUrlOf(pull)), signal),
        this.readReviewsAsync(repository, reference.number, token, signal), this.readCheckRunsAsync(repository, commit, token, signal)]);
      signal.throwIfAborted();
      return GitHubApi.read(() => GitHubReads.pullRequestPageOf(reference, pull, avatar, reviews, runs));
    });
    return this.tokens.holds(token) ? pullRequest : null;
  }

  public async readPullRequestThreadsAsync(reference: HostReference, signal: AbortSignal): Promise<HostPullRequestThreads> {
    const none: HostPullRequestThreads = new HostPullRequestThreads([], false);
    const token: string | null = reference.host === GitHubNames.moduleId
      ? await this.tokens.tokenForAsync(Resources.host, Resources.formatRepositoryName(reference.owner, reference.repository), signal) : null;
    const repository: GitHubRepository | null = GitHubRepository.parse(Resources.formatRepositoryName(reference.owner, reference.repository));
    if (reference.host !== GitHubNames.moduleId || token === null || repository === null)
      return none;
    const threads: HostPullRequestThreads = await this.askAsync(token, async () => {
      const pull: JsonReader | null = await this.api.getAsync(repository.pathOf(Resources.formatPullPath(reference.number)), token, signal);
      if (pull === null)
        return none;
      const conversationCount: number = GitHubApi.read(() => pull.readInteger(Resources.commentsField));
      const reviewCount: number = GitHubApi.read(() => pull.readInteger(Resources.reviewCommentsField));
      const [conversation, reviews] = await Promise.all([
        this.readNewestAsync(page => repository.pathOf(Resources.formatIssueCommentsPath(reference.number, page)), conversationCount, token, signal),
        this.readNewestAsync(page => repository.pathOf(Resources.formatPullCommentsPagePath(reference.number, page)), reviewCount, token, signal)]);
      return GitHubApi.read(() => new HostPullRequestThreads(GitHubReads.threadsOf(conversation.items, reviews.items), conversation.hasMore || reviews.hasMore));
    });
    return this.tokens.holds(token) ? threads : none;
  }

  public async createPullRequestAsync(draft: PullRequestDraft, signal: AbortSignal): Promise<HostItem> {
    const token: string | null = await this.tokens.tokenForAsync(draft.host, draft.path, signal);
    if (token === null)
      throw GitHubApi.failure(FailureCode.Unauthorized, Resources.signedOutMessage);
    const repository: GitHubRepository | null = GitHubRepository.parse(draft.path);
    if (draft.host !== Resources.host || repository === null)
      throw GitHubApi.failure(FailureCode.InvalidParams, Resources.otherHostMessage);
    return this.askAsync(token, async () => {
      const created: JsonReader = await this.api.postAsync(repository.pathOf(Resources.pullsPath), token, {
        [Resources.titleField]: draft.title, [Resources.bodyField]: draft.body, [Resources.headField]: draft.headBranch, [Resources.baseField]: draft.baseBranch,
        [Resources.draftField]: draft.isDraft
      }, signal);
      return GitHubApi.read(() => GitHubReads.pullRequestOf(new HostReference(GitHubNames.moduleId, repository.owner, repository.name,
        created.readInteger(Resources.numberField)), created, null));
    });
  }

  private async readItemAsync(reference: HostReference, signal: AbortSignal, withAvatar: boolean): Promise<HostItem | null> {
    const token: string | null = reference.host === GitHubNames.moduleId
      ? await this.tokens.tokenForAsync(Resources.host, Resources.formatRepositoryName(reference.owner, reference.repository), signal) : null;
    const repository: GitHubRepository | null = GitHubRepository.parse(Resources.formatRepositoryName(reference.owner, reference.repository));
    if (reference.host !== GitHubNames.moduleId || token === null || repository === null)
      return null;
    const item: HostItem | null = await this.askAsync(token, async () => {
      const issue: JsonReader | null = await this.api.getAsync(repository.pathOf(Resources.formatIssuePath(reference.number)), token, signal);
      if (issue === null)
        return null;
      const reading: Promise<string | null> = withAvatar ? this.avatars.readAsync(GitHubApi.read(() => GitHubReads.avatarUrlOf(issue)), signal) : Promise.resolve(null);
      const asking: Promise<JsonReader | null> = issue.hasField(Resources.pullRequestField)
        ? this.api.getAsync(repository.pathOf(Resources.formatPullPath(reference.number)), token, signal) : Promise.resolve(issue);
      const [pull, avatar] = await Promise.all([asking, reading]);
      signal.throwIfAborted();
      if (pull === issue)
        return GitHubApi.read(() => GitHubReads.issueOf(reference, issue, avatar));
      return pull === null ? null : GitHubApi.read(() => GitHubReads.pullRequestOf(reference, pull, avatar));
    });
    return this.tokens.holds(token) ? item : null;
  }

  private async readPullAnswerAsync(repository: GitHubRepository, number: number, headCommit: string | null, token: string,
    signal: AbortSignal): Promise<BranchPullRequest> {
    const pull: JsonReader | null = await this.api.getAsync(repository.pathOf(Resources.formatPullPath(number)), token, signal);
    if (pull === null)
      return new BranchPullRequest(null, []);
    const pullRequest: HostItem = GitHubApi.read(() => GitHubReads.pullRequestOf(new HostReference(GitHubNames.moduleId, repository.owner, repository.name, number), pull, null));
    const commit: string = headCommit ?? GitHubApi.read(() => pull.readObject(Resources.headField).readString(Resources.shaField));
    const checks: HostCheck[] = await this.readChecksAsync(repository, commit, token, signal);
    return new BranchPullRequest(pullRequest, checks, await this.readReviewDecisionAsync(repository, number, token, signal));
  }

  private async readChecksAsync(repository: GitHubRepository, commit: string, token: string, signal: AbortSignal): Promise<HostCheck[]> {
    const runs: readonly JsonReader[] = await this.readCheckRunsAsync(repository, commit, token, signal);
    return GitHubApi.read(() => runs.map(GitHubReads.checkOf));
  }

  private async readCheckRunsAsync(repository: GitHubRepository, commit: string, token: string, signal: AbortSignal): Promise<readonly JsonReader[]> {
    const runs: JsonReader[] = [];
    for (let page: number = 1; ; page++) {
      const answer: JsonReader | null = await this.api.getAsync(repository.pathOf(Resources.formatCheckRunsPath(commit, page)), token, signal);
      if (answer === null)
        return runs;
      const total: number = GitHubApi.read(() => answer.readInteger(Resources.totalCountField));
      const read: readonly JsonReader[] = GitHubApi.read(() => answer.readObjectArray(Resources.checkRunsField));
      runs.push(...read);
      if (read.length === 0 || runs.length >= total)
        return runs;
    }
  }

  private readReviewsAsync(repository: GitHubRepository, number: number, token: string, signal: AbortSignal): Promise<readonly JsonReader[]> {
    return this.readPagesAsync(page => repository.pathOf(Resources.formatReviewsPath(number, page)), Resources.reviewsPageSize, token, signal);
  }

  private async readNewestAsync(pathOf: (page: number) => string, count: number, token: string, signal: AbortSignal): Promise<NewestItems> {
    const kept: number = Resources.newestCommentsCount;
    const first: number = count <= kept ? 1 : Math.floor((count - kept) / Resources.commentsPageSize) + 1;
    const items: JsonReader[] = [];
    for (let page: number = first; ; page++) {
      const answer: JsonReader | null = await this.api.getAsync(pathOf(page), token, signal);
      const read: readonly JsonReader[] = answer === null ? [] : GitHubApi.read(() => answer.readObjectArray(Resources.itemsField));
      items.push(...read);
      if (read.length < Resources.commentsPageSize)
        return new NewestItems(items.slice(-kept), first > 1 || items.length > kept);
    }
  }

  private async readPagesAsync(pathOf: (page: number) => string, pageSize: number, token: string, signal: AbortSignal): Promise<readonly JsonReader[]> {
    const items: JsonReader[] = [];
    for (let page: number = 1; ; page++) {
      const answer: JsonReader | null = await this.api.getAsync(pathOf(page), token, signal);
      const read: readonly JsonReader[] = answer === null ? [] : GitHubApi.read(() => answer.readObjectArray(Resources.itemsField));
      items.push(...read);
      if (read.length < pageSize)
        return items;
    }
  }

  private async readRowAsync(repository: GitHubRepository, pull: JsonReader, token: string, signal: AbortSignal): Promise<HostPullRequestRow> {
    const number: number = GitHubApi.read(() => pull.readInteger(Resources.numberField));
    const head: JsonReader = GitHubApi.read(() => pull.readObject(Resources.headField));
    const commit: string = GitHubApi.read(() => head.readString(Resources.shaField));
    const [checks, verdicts] = await Promise.all([this.readChecksAsync(repository, commit, token, signal), this.readVerdictsAsync(repository, number, token, signal)]);
    return GitHubApi.read(() => HostPullRequestRow.of(new HostReference(GitHubNames.moduleId, repository.owner, repository.name, number),
      pull.readString(Resources.titleField), pull.readString(Resources.htmlUrlField), pull.readBoolean(Resources.draftField),
      verdicts.filter(t => t === Resources.approvedReview).length, checks, head.readString(Resources.refField),
      pull.readObject(Resources.baseField).readString(Resources.refField)));
  }

  private async readReviewDecisionAsync(repository: GitHubRepository, number: number, token: string, signal: AbortSignal): Promise<ReviewDecision> {
    const verdicts: readonly string[] = await this.readVerdictsAsync(repository, number, token, signal);
    return verdicts.includes(Resources.changesRequestedReview) ? ReviewDecision.ChangesRequested
      : verdicts.includes(Resources.approvedReview) ? ReviewDecision.Approved : ReviewDecision.Waiting;
  }

  private async readVerdictsAsync(repository: GitHubRepository, number: number, token: string, signal: AbortSignal): Promise<readonly string[]> {
    const latest: Map<string, string> = new Map<string, string>();
    for (let page: number = 1; ; page++) {
      const reviews: JsonReader | null = await this.api.getAsync(repository.pathOf(Resources.formatReviewsPath(number, page)), token, signal);
      const read: readonly ReviewVerdict[] = reviews === null ? []
        : GitHubApi.read(() => reviews.readObjectArray(Resources.itemsField).map(GitHubReads.reviewOf));
      for (const { login, state } of read)
        if (login !== null && (state === Resources.approvedReview || state === Resources.changesRequestedReview || state === Resources.dismissedReview))
          latest.set(login, state);
      if (read.length < Resources.reviewsPageSize)
        break;
    }
    return [...latest.values()];
  }

  private searchReviewRequestsAsync(token: string): Promise<ReviewSearchAnswer> {
    const now: number = Date.now();
    for (const kept of this.reviewSearches.keys()) {
      if (!this.tokens.holds(kept))
        this.reviewSearches.delete(kept);
    }
    const held: ReviewSearch | undefined = this.reviewSearches.get(token);
    if (held !== undefined && now - held.startedAt < Resources.reviewRequestsHeldFor)
      return held.answer;
    const answer: Promise<ReviewSearchAnswer> = this.askAsync<ReviewSearchAnswer>(token, async () => {
      const found: JsonReader | null = await this.api.getAsync(Resources.reviewRequestsPath, token, new AbortController().signal);
      return found === null ? new ReviewSearchAnswer([], false) : GitHubApi.read(() => GitHubReads.reviewSearchOf(found));
    });
    this.reviewSearches.set(token, new ReviewSearch(token, now, answer));
    return answer;
  }

  private async askAsync<T>(token: string, ask: () => Promise<T>): Promise<T> {
    try {
      return await ask();
    }
    catch (error) {
      if (GitHubApi.isUnauthorized(error))
        await this.tokens.refusedAsync(token);
      throw error;
    }
  }

  private static reviewSearchOf(found: JsonReader): ReviewSearchAnswer {
    const items: readonly JsonReader[] = found.readObjectArray(Resources.itemsField);
    const rows: HostReviewRequest[] = [];
    for (const item of items) {
      const address: string = item.readString(Resources.repositoryUrlField);
      const repository: GitHubRepository | null = address.startsWith(Resources.repositoryApiPrefix)
        ? GitHubRepository.parse(address.slice(Resources.repositoryApiPrefix.length)) : null;
      if (repository !== null)
        rows.push(new HostReviewRequest(new HostReference(GitHubNames.moduleId, repository.owner, repository.name, item.readInteger(Resources.numberField)),
          item.readString(Resources.titleField), item.readString(Resources.htmlUrlField), item.hasField(Resources.draftField) && item.readBoolean(Resources.draftField),
          Date.parse(item.readString(Resources.createdAtField))));
    }
    return new ReviewSearchAnswer(rows, found.readInteger(Resources.totalCountField) > items.length || found.readBoolean(Resources.incompleteResultsField));
  }

  private static bringerOf(pulls: readonly JsonReader[]): number | null {
    const merged: JsonReader | undefined = pulls.find(t => t.readNullableString(Resources.mergedAtField) !== null && GitHubReads.isIntoDefault(t));
    const chosen: JsonReader | undefined = merged ?? pulls[0];
    return chosen === undefined ? null : chosen.readInteger(Resources.numberField);
  }

  private static isIntoDefault(pull: JsonReader): boolean {
    const base: JsonReader = pull.readObject(Resources.baseField);
    return base.readString(Resources.refField) === base.readObject(Resources.repoField).readString(Resources.defaultBranchField);
  }

  private static commitCommentsOf(commit: string, commitComments: readonly JsonReader[], reviewComments: readonly JsonReader[]): HostCommitComments {
    const onCommit: readonly JsonReader[] = reviewComments.filter(t => [Resources.commitIdField, Resources.originalCommitIdField]
      .some(field => t.hasField(field) && t.readNullableString(field) === commit));
    const first: JsonReader | undefined = commitComments[0] ?? onCommit[0];
    const url: URL | null = first === undefined ? null : URL.parse(first.readString(Resources.htmlUrlField));
    if (url === null || url.protocol !== Resources.httpsProtocol || url.hostname !== Resources.host || url.username.length > 0 || url.password.length > 0)
      return HostCommitComments.none();
    const count: number = commitComments.length + onCommit.length;
    return new HostCommitComments(Math.min(count, HostCommitComments.maximumCount), count > HostCommitComments.maximumCount
      || commitComments.length >= Resources.commentsPageSize || reviewComments.length >= Resources.commentsPageSize, url.href);
  }

  private static repositoryKeyOf(owner: string, name: string): string {
    return `${owner}/${name}`.toLowerCase();
  }

  private static avatarUrlOf(item: JsonReader): string | null {
    return item.readNullableObject(Resources.userField)?.readNullableString(Resources.avatarUrlField) ?? null;
  }

  private static profileOf(user: JsonReader): string | null {
    const address: string | null = user.hasField(Resources.htmlUrlField) ? user.readNullableString(Resources.htmlUrlField) : null;
    const url: URL | null = address === null ? null : URL.parse(address);
    return url === null || url.protocol !== Resources.httpsProtocol || url.username.length > 0 || url.password.length > 0 ? null : address;
  }

  private static issueOf(reference: HostReference, issue: JsonReader, avatar: string | null): HostItem {
    const isOpen: boolean = issue.readString(Resources.stateField) === Resources.openState;
    const notPlanned: boolean = issue.readNullableString(Resources.stateReasonField) === Resources.notPlannedReason;
    const state: ReferenceState = isOpen ? ReferenceState.Open : notPlanned ? ReferenceState.ClosedNotPlanned : ReferenceState.ClosedDone;
    const closedAt: number | null = isOpen ? null : Date.parse(issue.readString(Resources.closedAtField));
    return GitHubReads.itemOf(reference, ReferenceKind.Issue, state, issue, closedAt, avatar, null);
  }

  private static pullRequestOf(reference: HostReference, pull: JsonReader, avatar: string | null): HostItem {
    const head: JsonReader = pull.readObject(Resources.headField);
    const changes: HostChanges = new HostChanges(pull.readInteger(Resources.additionsField), pull.readInteger(Resources.deletionsField),
      pull.readInteger(Resources.changedFilesField), head.readString(Resources.refField), pull.readObject(Resources.baseField).readString(Resources.refField),
      head.readString(Resources.shaField));
    const mergedAt: string | null = pull.readNullableString(Resources.mergedAtField);
    const isOpen: boolean = pull.readString(Resources.stateField) === Resources.openState;
    const state: ReferenceState = mergedAt !== null ? ReferenceState.Merged : !isOpen ? ReferenceState.Closed
      : pull.readBoolean(Resources.draftField) ? ReferenceState.Draft : ReferenceState.Open;
    const closedAt: number | null = mergedAt !== null ? Date.parse(mergedAt) : isOpen ? null : Date.parse(pull.readString(Resources.closedAtField));
    return GitHubReads.itemOf(reference, ReferenceKind.PullRequest, state, pull, closedAt, avatar, changes);
  }

  private static itemOf(reference: HostReference, kind: ReferenceKind, state: ReferenceState, item: JsonReader, closedAt: number | null,
    avatar: string | null, changes: HostChanges | null): HostItem {
    const user: JsonReader | null = item.readNullableObject(Resources.userField);
    const author: HostPerson | null = user === null ? null : new HostPerson(user.readNonBlankString(Resources.loginField), avatar, GitHubReads.profileOf(user));
    return new HostItem(reference, kind, state, item.readString(Resources.titleField), item.readString(Resources.htmlUrlField), author,
      Date.parse(item.readString(Resources.createdAtField)), closedAt, item.readInteger(Resources.commentsField), changes);
  }

  private static pullRequestPageOf(reference: HostReference, pull: JsonReader, avatar: string | null, reviews: readonly JsonReader[],
    runs: readonly JsonReader[]): HostPullRequest {
    const autoMerge: JsonReader | null = pull.readNullableObject(Resources.autoMergeField);
    const mergeableState: string = pull.readString(Resources.mergeableStateField);
    return new HostPullRequest(GitHubReads.pullRequestOf(reference, pull, avatar), GitHubReads.reviewersOf(pull, reviews), [], runs.map(GitHubReads.buildOf),
      autoMerge !== null, pull.readNullableString(Resources.bodyField) ?? "", pull.readInteger(Resources.commitsField), [],
      autoMerge === null ? null : autoMerge.readString(Resources.mergeMethodField),
      mergeableState === Resources.unknownMergeableState ? null : mergeableState === Resources.dirtyMergeableState);
  }

  private static reviewersOf(pull: JsonReader, reviews: readonly JsonReader[]): HostReviewer[] {
    const author: string | null = pull.readNullableObject(Resources.userField)?.readNonBlankString(Resources.loginField) ?? null;
    const people: Map<string, HostPerson> = new Map<string, HostPerson>();
    const verdicts: Map<string, string> = new Map<string, string>();
    for (const review of reviews) {
      const user: JsonReader | null = review.readNullableObject(Resources.userField);
      const state: string = review.readString(Resources.stateField);
      if (user === null || state === Resources.pendingReview)
        continue;
      const person: HostPerson = GitHubReads.personOf(user);
      if (person.login === author)
        continue;
      people.set(person.login, person);
      if (state !== Resources.commentedReview)
        verdicts.set(person.login, state);
    }
    const asked: readonly HostPerson[] = pull.readObjectArray(Resources.requestedReviewersField).map(GitHubReads.personOf);
    const askedLogins: ReadonlySet<string> = new Set(asked.map(t => t.login));
    const reviewed: readonly HostReviewer[] = [...people.values()].filter(t => !askedLogins.has(t.login)).map(t => {
      const state: string | undefined = verdicts.get(t.login);
      return state === Resources.approvedReview ? new HostReviewer(t, 1, Resources.approvedLabel, false)
        : state === Resources.changesRequestedReview ? new HostReviewer(t, -1, Resources.changesRequestedLabel, false)
          : new HostReviewer(t, 0, Resources.commentedLabel, false);
    });
    const teams: readonly HostPerson[] = pull.readObjectArray(Resources.requestedTeamsField).map(GitHubReads.teamOf);
    return [...reviewed, ...[...asked, ...teams].map(t => new HostReviewer(t, 0, Resources.reviewRequestedLabel, false))];
  }

  private static buildOf(run: JsonReader): HostBuild {
    const check: HostCheck = GitHubReads.checkOf(run);
    const startedAt: string | null = run.readNullableString(Resources.startedAtField);
    const completedAt: string | null = run.readNullableString(Resources.completedAtField);
    const isFinished: boolean = check.state !== CheckState.Queued && check.state !== CheckState.Running;
    return new HostBuild(check.name, check.state, check.url, startedAt === null ? null : Date.parse(startedAt),
      completedAt === null || !isFinished ? null : Date.parse(completedAt));
  }

  private static threadsOf(conversation: readonly JsonReader[], reviews: readonly JsonReader[]): HostThread[] {
    const onFiles: Map<number, HostThread> = new Map<number, HostThread>();
    for (const comment of reviews.filter(GitHubReads.hasText)) {
      const replyTo: number | null = comment.hasField(Resources.inReplyToIdField) ? comment.readNullableInteger(Resources.inReplyToIdField) : null;
      const root: number = replyTo ?? comment.readInteger(Resources.idField);
      const held: HostThread | undefined = onFiles.get(root);
      onFiles.set(root, held === undefined
        ? new HostThread(GitHubReads.fileThreadIdOf(root), ThreadStatus.None, comment.readNonBlankString(Resources.pathField),
          comment.readNullableInteger(Resources.lineField) ?? comment.readNullableInteger(Resources.originalLineField), [GitHubReads.commentOf(comment, null)])
        : new HostThread(held.id, held.state, held.path, held.line,
          [...held.comments, GitHubReads.commentOf(comment, held.comments.some(t => t.id === replyTo) ? replyTo : null)]));
    }
    const threads: readonly HostThread[] = [...conversation.filter(GitHubReads.hasText).map(t => new HostThread(
      GitHubReads.conversationThreadIdOf(t.readInteger(Resources.idField)), ThreadStatus.None, null, null, [GitHubReads.commentOf(t, null)])), ...onFiles.values()];
    return threads.toSorted((a, b) => GitHubReads.startOf(a) - GitHubReads.startOf(b));
  }

  private static conversationThreadIdOf(commentId: number): number {
    return commentId * 2;
  }

  private static fileThreadIdOf(rootId: number): number {
    return rootId * 2 + 1;
  }

  private static hasText(comment: JsonReader): boolean {
    return (comment.readNullableString(Resources.bodyField) ?? "").trim().length > 0;
  }

  private static startOf(thread: HostThread): number {
    return Math.min(...thread.comments.map(t => t.publishedAt));
  }

  private static commentOf(comment: JsonReader, parent: number | null): HostComment {
    const user: JsonReader | null = comment.readNullableObject(Resources.userField);
    return new HostComment(comment.readInteger(Resources.idField), parent, user === null ? new HostPerson(Resources.ghostLogin, null, null) : GitHubReads.personOf(user),
      Date.parse(comment.readString(Resources.createdAtField)), comment.readString(Resources.bodyField));
  }

  private static teamOf(team: JsonReader): HostPerson {
    return new HostPerson(team.readNonBlankString(Resources.nameField), null, GitHubReads.profileOf(team));
  }

  private static personOf(user: JsonReader): HostPerson {
    return new HostPerson(user.readNonBlankString(Resources.loginField), null, GitHubReads.profileOf(user));
  }

  private static checkOf(run: JsonReader): HostCheck {
    const status: string = run.readString(Resources.statusField);
    const state: CheckState = status !== Resources.completedCheckStatus ? (status === Resources.runningCheckStatus ? CheckState.Running : CheckState.Queued)
      : GitHubReads.conclusionOf(run.readString(Resources.conclusionField));
    return new HostCheck(run.readNonBlankString(Resources.nameField), state, run.readNullableString(Resources.htmlUrlField));
  }

  private static reviewOf(review: JsonReader): ReviewVerdict {
    const login: string | null = review.readNullableObject(Resources.userField)?.readString(Resources.loginField) ?? null;
    const isReviewer: boolean = Resources.reviewerAssociations.includes(review.readString(Resources.authorAssociationField));
    return new ReviewVerdict(isReviewer ? login : null, review.readString(Resources.stateField));
  }

  private static conclusionOf(conclusion: string): CheckState {
    return Resources.succeededConclusions.includes(conclusion) ? CheckState.Succeeded
      : Resources.neutralConclusions.includes(conclusion) ? CheckState.Neutral : CheckState.Failed;
  }
}
