/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { JsonReader, JsonValue } from "@noldova/context.json";
import { FailureCode } from "@noldova/desktop.protocol";
import { AzureDevOpsNames } from "@noldova/git.azure-devops.protocol";
import type { HostComment, HostReference, HostReviewer, HostWorkItemDetail, WorkItemUpdate } from "@noldova/git.hosting.protocol";

import type { IAzureToken } from "../interfaces/i-azure-token.ts";
import type { AzureCredential } from "../models/azure-credential.ts";
import type { BranchLink } from "../models/branch-link.ts";
import type { PullRequestAbandonment } from "../models/pull-request-abandonment.ts";
import type { PullRequestCompletion } from "../models/pull-request-completion.ts";
import type { PullRequestVote } from "../models/pull-request-vote.ts";
import type { ReviewerAddition } from "../models/reviewer-addition.ts";
import type { ThreadChange } from "../models/thread-change.ts";
import type { ThreadReply } from "../models/thread-reply.ts";
import { Resources } from "../resources.ts";
import { AzureApi } from "./azure-api.ts";
import { AzureReads } from "./azure-reads.ts";

export class AzureWrites {
  private readonly api: AzureApi;
  private readonly signIn: IAzureToken;
  private readonly reads: AzureReads;

  public constructor(api: AzureApi, signIn: IAzureToken, reads: AzureReads) {
    this.api = api;
    this.signIn = signIn;
    this.reads = reads;
  }

  public async linkBranchAsync(link: BranchLink, signal: AbortSignal): Promise<void> {
    const { organization, project, name } = link.repository;
    const token: AzureCredential = this.tokenFor(organization);
    const found: JsonReader | null = await this.askAsync(token, () => this.api.getAsync(Resources.formatRepositoryUrl(organization, project, name), token, signal));
    if (found === null)
      throw AzureApi.failure(FailureCode.NotFound, Resources.repositoryNotFoundMessage);
    const artifact: string = AzureApi.read(() => Resources.formatBranchArtifact(found.readObject(Resources.projectField).readNonBlankString(Resources.idField),
      found.readNonBlankString(Resources.idField), link.branch));
    await this.writeAsync(token, () => this.api.patchAsync(Resources.formatWorkItemUrl(organization, link.id), token, [{ op: Resources.addOperation,
      path: Resources.relationsPath, value: { rel: Resources.artifactLinkRelation, url: artifact, attributes: { name: Resources.branchLinkName } } }], signal),
    Resources.cannotWriteWorkItemsMessage, Resources.workItemNotFoundMessage);
  }

  public async updateWorkItemAsync(update: WorkItemUpdate, signal: AbortSignal): Promise<HostWorkItemDetail> {
    const token: AzureCredential = this.tokenFor(update.host === AzureDevOpsNames.moduleId ? update.organization : null);
    const changes: JsonValue[] = [];
    if (update.state !== null)
      changes.push({ op: Resources.addOperation, path: Resources.statePath, value: update.state });
    if (update.assignToMe)
      changes.push({ op: Resources.addOperation, path: Resources.assignedToPath, value: await this.readLoginAsync(update.organization, token, signal) });
    const changed: JsonReader = await this.writeAsync(token, () => this.api.patchAsync(Resources.formatWorkItemExpandedUrl(update.organization, update.id), token,
      changes, signal), Resources.cannotWriteWorkItemsMessage, Resources.workItemNotFoundMessage);
    return this.reads.readDetailAsync(update.organization, changed, token, signal);
  }

  public async replyToThreadAsync(reply: ThreadReply, signal: AbortSignal): Promise<HostComment> {
    const { owner, repository, number } = reply.reference;
    const token: AzureCredential = this.codeTokenFor(owner);
    const comment: JsonReader = await this.writeAsync(token, () => this.api.createAsync(Resources.formatThreadCommentsUrl(owner, repository, number, reply.thread),
      token, { [Resources.contentField]: reply.body, [Resources.parentCommentIdField]: reply.parent, [Resources.commentTypeField]: Resources.textCommentKind },
      signal), Resources.cannotWriteCodeMessage, Resources.threadNotFoundMessage);
    return AzureApi.read(() => AzureReads.commentOf(comment));
  }

  public async changeThreadAsync(change: ThreadChange, signal: AbortSignal): Promise<void> {
    const { owner, repository, number } = change.reference;
    const token: AzureCredential = this.codeTokenFor(owner);
    await this.writeAsync(token, () => this.api.updateAsync(Resources.formatThreadUrl(owner, repository, number, change.thread), token,
      { [Resources.statusField]: Resources.threadWrites[change.state] }, signal), Resources.cannotWriteCodeMessage, Resources.threadNotFoundMessage);
  }

  public async voteAsync(vote: PullRequestVote, signal: AbortSignal): Promise<HostReviewer> {
    const { owner, repository, number } = vote.reference;
    const token: AzureCredential = this.codeTokenFor(owner);
    const connection: JsonReader = await this.readConnectionAsync(owner, token, signal);
    const reviewer: string = AzureApi.read(() => connection.readObject(Resources.authenticatedUserField).readNonBlankString(Resources.idField));
    const answer: JsonReader = await this.writeAsync(token, () => this.api.putAsync(Resources.formatReviewerUrl(owner, repository, number, reviewer), token,
      { [Resources.voteField]: vote.vote }, signal), Resources.cannotVoteMessage, Resources.pullRequestNotFoundMessage);
    return AzureApi.read(() => AzureReads.reviewerOf(answer));
  }

  public async completePullRequestAsync(completion: PullRequestCompletion, signal: AbortSignal): Promise<void> {
    const token: AzureCredential = this.codeTokenFor(completion.reference.owner);
    const url: string = await this.checkCompletionAsync(completion, true, token, signal);
    await this.writeAsync(token, () => this.api.updateAsync(url, token, {
      [Resources.statusField]: Resources.completedStatus,
      [Resources.lastMergeSourceCommitField]: { [Resources.commitIdField]: completion.sourceCommit },
      [Resources.completionOptionsField]: AzureWrites.optionsOf(completion)
    }, signal), Resources.cannotCompleteMessage, Resources.pullRequestNotFoundMessage);
  }

  public async setAutoCompleteAsync(completion: PullRequestCompletion, signal: AbortSignal): Promise<void> {
    const token: AzureCredential = this.codeTokenFor(completion.reference.owner);
    const url: string = await this.checkCompletionAsync(completion, false, token, signal);
    const connection: JsonReader = await this.readConnectionAsync(completion.reference.owner, token, signal);
    const person: string = AzureApi.read(() => connection.readObject(Resources.authenticatedUserField).readNonBlankString(Resources.idField));
    await this.writeAsync(token, () => this.api.updateAsync(url, token, {
      [Resources.autoCompleteSetByField]: { [Resources.idField]: person },
      [Resources.completionOptionsField]: AzureWrites.optionsOf(completion)
    }, signal), Resources.cannotCompleteMessage, Resources.pullRequestNotFoundMessage);
  }

  public async cancelAutoCompleteAsync(reference: HostReference, signal: AbortSignal): Promise<void> {
    const token: AzureCredential = this.codeTokenFor(reference.owner);
    const url: string = Resources.formatPullRequestUrl(reference.owner, reference.repository, reference.number);
    const pull: JsonReader = await this.readPullAsync(url, token, signal);
    if (AzureApi.read(() => pull.readString(Resources.statusField)) !== Resources.activeStatus)
      throw AzureApi.failure(FailureCode.Conflict, Resources.notActiveMessage);
    await this.writeAsync(token, () => this.api.updateAsync(url, token, { [Resources.autoCompleteSetByField]: { [Resources.idField]: Resources.noIdentity } }, signal),
      Resources.cannotChangePullRequestMessage, Resources.pullRequestNotFoundMessage);
  }

  public async abandonPullRequestAsync(abandonment: PullRequestAbandonment, signal: AbortSignal): Promise<void> {
    const { owner, repository, number } = abandonment.reference;
    const token: AzureCredential = this.codeTokenFor(owner);
    const url: string = Resources.formatPullRequestUrl(owner, repository, number);
    const pull: JsonReader = await this.readPullAsync(url, token, signal);
    const stale: string | null = AzureApi.read(() => pull.readString(Resources.statusField) !== Resources.activeStatus ? Resources.notActiveMessage
      : pull.readObject(Resources.lastMergeSourceCommitField).readString(Resources.commitIdField) === abandonment.sourceCommit ? null
        : Resources.abandonSourceChangedMessage);
    if (stale !== null)
      throw AzureApi.failure(FailureCode.Conflict, stale);
    await this.writeAsync(token, () => this.api.updateAsync(url, token, { [Resources.statusField]: Resources.abandonedStatus }, signal),
      Resources.cannotChangePullRequestMessage, Resources.pullRequestNotFoundMessage);
  }

  private async readPullAsync(url: string, token: AzureCredential, signal: AbortSignal): Promise<JsonReader> {
    const pull: JsonReader | null = await this.askAsync(token, () => this.api.getAsync(url, token, signal));
    if (pull === null)
      throw AzureApi.failure(FailureCode.NotFound, Resources.pullRequestNotFoundMessage);
    return pull;
  }

  private async checkCompletionAsync(completion: PullRequestCompletion, needsCleanMerge: boolean, token: AzureCredential, signal: AbortSignal): Promise<string> {
    const { owner, repository, number } = completion.reference;
    const url: string = Resources.formatPullRequestUrl(owner, repository, number);
    const pull: JsonReader = await this.readPullAsync(url, token, signal);
    const stale: string | null = AzureApi.read(() => AzureWrites.staleOf(pull, completion, needsCleanMerge));
    if (stale !== null)
      throw AzureApi.failure(FailureCode.Conflict, stale);
    const project: string = AzureApi.read(() => pull.readObject(Resources.repositoryField).readObject(Resources.projectField).readNonBlankString(Resources.idField));
    const allowed: readonly string[] = await this.askAsync(token, () => this.reads.readAllowedMergeTypesAsync(owner, project, number, token, signal));
    if (!allowed.includes(completion.mergeType))
      throw AzureApi.failure(FailureCode.Conflict, Resources.mergeTypeNotAllowedMessage);
    return url;
  }

  public async addReviewerAsync(addition: ReviewerAddition, signal: AbortSignal): Promise<HostReviewer> {
    const { owner, repository, number } = addition.reference;
    const token: AzureCredential = this.codeTokenFor(owner);
    const key: JsonReader | null = await this.askAsync(token, () => this.api.getAsync(Resources.formatStorageKeyUrl(owner, addition.descriptor), token, signal),
      Resources.cannotReadPeopleMessage);
    if (key === null)
      throw AzureApi.failure(FailureCode.NotFound, Resources.personNotFoundMessage);
    const id: string = AzureApi.read(() => key.readNonBlankString(Resources.valueField));
    const answer: JsonReader = await this.writeAsync(token, () => this.api.createAsync(Resources.formatReviewersUrl(owner, repository, number), token,
      [{ [Resources.idField]: id }], signal), Resources.cannotAddReviewerMessage, Resources.pullRequestNotFoundMessage);
    return AzureApi.read(() => {
      const added: JsonReader | undefined = answer.readObjectArray(Resources.valueField).find(t => t.readString(Resources.idField).toLowerCase() === id.toLowerCase());
      if (added === undefined)
        throw new SyntaxError(Resources.unreadableAnswerMessage);
      return AzureReads.reviewerOf(added);
    });
  }

  private tokenFor(organization: string | null): AzureCredential {
    const token: AzureCredential | null = this.signIn.token;
    const signedIn: string | null = this.signIn.organization;
    if (token === null || signedIn === null || organization === null || !Resources.isSameOrganization(signedIn, organization))
      throw AzureApi.failure(FailureCode.Unauthorized, Resources.signedOutMessage);
    return token;
  }

  private codeTokenFor(organization: string): AzureCredential {
    const token: AzureCredential = this.tokenFor(organization);
    if (!token.canWriteCode)
      throw AzureApi.failure(FailureCode.Unauthorized, Resources.signInAgainForCodeMessage);
    return token;
  }

  private async readLoginAsync(organization: string, token: AzureCredential, signal: AbortSignal): Promise<string> {
    const connection: JsonReader = await this.readConnectionAsync(organization, token, signal);
    return AzureApi.read(() => connection.readObject(Resources.authenticatedUserField).readObject(Resources.propertiesField)
      .readObject(Resources.accountProperty).readNonBlankString(Resources.propertyValueField));
  }

  private async readConnectionAsync(organization: string, token: AzureCredential, signal: AbortSignal): Promise<JsonReader> {
    const connection: JsonReader | null = await this.askAsync(token, () => this.api.getAsync(Resources.formatConnectionDataUrl(organization), token, signal));
    if (connection === null)
      throw AzureApi.failure(FailureCode.Unavailable, Resources.unreadableAnswerMessage);
    return connection;
  }

  private async askAsync<T>(token: AzureCredential, ask: () => Promise<T>, cannotRead: string | null = null): Promise<T> {
    try {
      return await ask();
    }
    catch (error) {
      if (!AzureApi.isUnauthorized(error))
        throw error;
      await this.signIn.refusedAsync(token);
      throw cannotRead !== null && this.signIn.token === token ? AzureApi.failure(FailureCode.Unauthorized, cannotRead) : error;
    }
  }

  private async writeAsync(token: AzureCredential, write: () => Promise<JsonReader | null>, cannotWrite: string, missing: string): Promise<JsonReader> {
    let written: JsonReader | null;
    try {
      written = await write();
    }
    catch (error) {
      if (!AzureApi.isUnauthorized(error))
        throw error;
      await this.signIn.refusedAsync(token);
      throw this.signIn.token === token ? AzureApi.failure(FailureCode.Unauthorized, cannotWrite) : error;
    }
    if (written === null)
      throw AzureApi.failure(FailureCode.NotFound, missing);
    return written;
  }

  private static optionsOf(completion: PullRequestCompletion): JsonValue {
    return { [Resources.mergeStrategyField]: completion.mergeType, [Resources.mergeCommitMessageField]: completion.message,
      [Resources.transitionWorkItemsField]: completion.completeWorkItems, [Resources.deleteSourceBranchField]: completion.deleteSourceBranch };
  }

  private static staleOf(pull: JsonReader, completion: PullRequestCompletion, needsCleanMerge: boolean): string | null {
    if (pull.readString(Resources.statusField) !== Resources.activeStatus)
      return Resources.notActiveMessage;
    if (pull.readBoolean(Resources.isDraftField))
      return Resources.draftMessage;
    if (needsCleanMerge && (!pull.hasField(Resources.mergeStatusField) || pull.readString(Resources.mergeStatusField) !== Resources.mergeSucceededStatus))
      return Resources.mergeNotReadyMessage;
    if (pull.readObject(Resources.lastMergeSourceCommitField).readString(Resources.commitIdField) !== completion.sourceCommit)
      return Resources.sourceChangedMessage;
    return pull.readString(Resources.targetRefNameField) === Resources.headsPrefix + completion.targetBranch ? null : Resources.targetChangedMessage;
  }
}
