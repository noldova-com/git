/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { JsonReader } from "@noldova/context.json";
import { FailureCode } from "@noldova/desktop.protocol";
import { BranchPullRequest, type BranchQuery, CheckState, HostChanges, HostCheck, HostItem, HostPerson, HostReference, type PullRequestDraft,
  ReferenceKind, ReferenceState } from "@noldova/git.hosting.protocol";
import { GitHubNames } from "@noldova/git.github.protocol";

import type { IGitHubToken } from "../interfaces/i-github-token.ts";
import { GitHubRepository } from "../models/github-repository.ts";
import { Resources } from "../resources.ts";
import { GitHubApi } from "./github-api.ts";
import type { GitHubAvatars } from "./github-avatars.ts";

export class GitHubReads {
  private readonly api: GitHubApi;
  private readonly signIn: IGitHubToken;
  private readonly avatars: GitHubAvatars;

  public constructor(api: GitHubApi, signIn: IGitHubToken, avatars: GitHubAvatars) {
    this.api = api;
    this.signIn = signIn;
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
    const token: string | null = this.signIn.token;
    const repository: GitHubRepository | null = GitHubRepository.parse(query.path);
    if (query.host !== Resources.host || token === null || repository === null)
      return none;
    const answer: BranchPullRequest = await this.askAsync(token, async () => {
      const head: string = encodeURIComponent(Resources.formatHeadFilter(repository.owner, query.branch));
      const list: JsonReader | null = await this.api.getAsync(repository.pathOf(Resources.formatBranchPullsPath(head)), token, signal);
      const first: JsonReader | undefined = list === null ? undefined : GitHubApi.read(() => list.readObjectArray(Resources.itemsField))[0];
      if (first === undefined)
        return none;
      const number: number = GitHubApi.read(() => first.readInteger(Resources.numberField));
      const pull: JsonReader | null = await this.api.getAsync(repository.pathOf(Resources.formatPullPath(number)), token, signal);
      if (pull === null)
        return none;
      const pullRequest: HostItem = GitHubApi.read(() => GitHubReads.pullRequestOf(new HostReference(GitHubNames.moduleId, repository.owner, repository.name, number), pull, null));
      const commit: string = query.headCommit ?? GitHubApi.read(() => pull.readObject(Resources.headField).readString(Resources.shaField));
      return new BranchPullRequest(pullRequest, await this.readChecksAsync(repository, commit, token, signal));
    });
    return this.signIn.token === token ? answer : none;
  }

  public async createPullRequestAsync(draft: PullRequestDraft, signal: AbortSignal): Promise<HostItem> {
    const token: string | null = this.signIn.token;
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
    const token: string | null = this.signIn.token;
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
    return this.signIn.token === token ? item : null;
  }

  private async readChecksAsync(repository: GitHubRepository, commit: string, token: string, signal: AbortSignal): Promise<HostCheck[]> {
    const checks: HostCheck[] = [];
    for (let page: number = 1; ; page++) {
      const runs: JsonReader | null = await this.api.getAsync(repository.pathOf(Resources.formatCheckRunsPath(commit, page)), token, signal);
      if (runs === null)
        return checks;
      const total: number = GitHubApi.read(() => runs.readInteger(Resources.totalCountField));
      const read: readonly HostCheck[] = GitHubApi.read(() => runs.readObjectArray(Resources.checkRunsField).map(GitHubReads.checkOf));
      checks.push(...read);
      if (read.length === 0 || checks.length >= total)
        return checks;
    }
  }

  private async askAsync<T>(token: string, ask: () => Promise<T>): Promise<T> {
    try {
      return await ask();
    }
    catch (error) {
      if (GitHubApi.isUnauthorized(error))
        await this.signIn.refusedAsync(token);
      throw error;
    }
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

  private static checkOf(run: JsonReader): HostCheck {
    const status: string = run.readString(Resources.statusField);
    const state: CheckState = status !== Resources.completedCheckStatus ? (status === Resources.runningCheckStatus ? CheckState.Running : CheckState.Queued)
      : GitHubReads.conclusionOf(run.readString(Resources.conclusionField));
    return new HostCheck(run.readNonBlankString(Resources.nameField), state, run.readNullableString(Resources.htmlUrlField));
  }

  private static conclusionOf(conclusion: string): CheckState {
    return Resources.succeededConclusions.includes(conclusion) ? CheckState.Succeeded
      : Resources.neutralConclusions.includes(conclusion) ? CheckState.Neutral : CheckState.Failed;
  }
}
