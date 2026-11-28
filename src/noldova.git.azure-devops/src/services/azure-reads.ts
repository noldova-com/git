/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { JsonReader, type JsonValue } from "@noldova/context.json";
import { FailureCode } from "@noldova/desktop.protocol";
import { type IModuleLog, MethodFailureException } from "@noldova/desktop.runtime";
import { AzureDevOpsNames } from "@noldova/git.azure-devops.protocol";
import { BranchPullRequest, type BranchQuery, CheckState, type CommitQuery, FileChangeKind, HostBuild, HostChanges, HostCheck, HostComment, HostCommitComments,
  HostItem, HostPerson, HostPolicy, HostPullRequest, HostPullRequestCommit, HostPullRequestCommits, HostPullRequestConflicts, HostPullRequestFile,
  HostPullRequestFiles, HostPullRequestHead, HostPullRequestHeads, HostPullRequestList, HostPullRequestRow, HostPullRequestUpdate, HostPullRequestUpdates,
  HostReference, HostReviewer, HostReviewRequest, HostReviewRequestList, HostThread, HostWorkItem, HostWorkItemDetail, HostWorkItemLink, HostWorkItemList,
  HostWorkItemType, PolicyState, ReferenceKind, ReferenceState, type RepositoryQuery, ReviewDecision, ThreadStatus, WorkItemCategory, type WorkItemQuery,
  WorkItemScope, type WorkItemsQuery } from "@noldova/git.hosting.protocol";

import type { IAzureTokens } from "../interfaces/i-azure-tokens.ts";
import { AccountReviewRequests } from "../models/account-review-requests.ts";
import { AccountWorkItems } from "../models/account-work-items.ts";
import type { AzureCredential } from "../models/azure-credential.ts";
import { AzureRepository } from "../models/azure-repository.ts";
import { ChangeCounts } from "../models/change-counts.ts";
import { EvaluatedPolicy } from "../models/evaluated-policy.ts";
import { FoundPerson } from "../models/found-person.ts";
import { KnownReviewer } from "../models/known-reviewer.ts";
import { LineCounts } from "../models/line-counts.ts";
import type { PeopleQuery } from "../models/people-query.ts";
import { QueriedIds } from "../models/queried-ids.ts";
import { RanBuild } from "../models/ran-build.ts";
import type { SignedInAccount } from "../models/signed-in-account.ts";
import { WorkItemTypeStates } from "../models/work-item-type-states.ts";
import { Resources } from "../resources.ts";
import { AzureApi } from "./azure-api.ts";

export class AzureReads {
  private readonly api: AzureApi;
  private readonly signIn: IAzureTokens;
  private readonly log: IModuleLog;
  private static readonly unstopped: AbortSignal = new AbortController().signal;
  private readonly types: Map<string, Promise<WorkItemTypeStates>> = new Map();
  private typesToken: AzureCredential | null = null;
  private reviewers: readonly KnownReviewer[] = [];
  private readonly repositories: Map<string, readonly [string, string]> = new Map();

  public constructor(api: AzureApi, signIn: IAzureTokens, log: IModuleLog) {
    this.api = api;
    this.signIn = signIn;
    this.log = log;
  }

  public async readReferenceAsync(reference: HostReference, signal: AbortSignal): Promise<HostItem | null> {
    const token: AzureCredential | null = this.tokenOf(reference);
    if (token === null)
      return null;
    const item: HostItem | null = await this.askAsync(token, async () => {
      const pull: JsonReader | null = await this.api.getAsync(Resources.formatPullRequestUrl(reference.owner, reference.repository, reference.number),
        token, signal);
      if (pull === null)
        return null;
      const project: string = AzureApi.read(() => pull.readObject(Resources.repositoryField).readObject(Resources.projectField).readString(Resources.idField));
      const counts: ChangeCounts | null = await this.readCountsAsync(reference, project, token, signal);
      return AzureApi.read(() => AzureReads.itemOf(reference.owner, pull, counts));
    });
    return this.signIn.holds(token) ? item : null;
  }

  public async readPullRequestAsync(reference: HostReference, signal: AbortSignal): Promise<HostPullRequest | null> {
    const token: AzureCredential | null = this.tokenOf(reference);
    if (token === null)
      return null;
    const pullRequest: HostPullRequest | null = await this.askAsync(token, async () => {
      const pull: JsonReader | null = await this.api.getAsync(Resources.formatPullRequestUrl(reference.owner, reference.repository, reference.number),
        token, signal);
      if (pull === null)
        return null;
      const item: HostItem = AzureApi.read(() => AzureReads.itemOf(reference.owner, pull));
      const project: string = AzureApi.read(() => pull.readObject(Resources.repositoryField).readObject(Resources.projectField).readNonBlankString(Resources.idField));
      const [policies, builds, commitCount, workItems] = await Promise.all([this.readPoliciesAsync(item, project, token, signal),
        this.readBuildsAsync(item, project, token, signal),
        this.readCommitCountAsync(reference, token, signal), this.readWorkItemLinksAsync(reference, token, signal)]);
      return AzureApi.read(() => new HostPullRequest(item, pull.readObjectArray(Resources.reviewersField).map(AzureReads.reviewerOf),
        policies.map(t => AzureReads.withBuildNumber(t.policy, t.buildId, builds)), builds.map(t => t.build),
        pull.hasField(Resources.autoCompleteSetByField),
        pull.hasField(Resources.descriptionField) ? pull.readString(Resources.descriptionField) : "", commitCount, workItems,
        AzureReads.autoCompleteMergeTypeOf(pull)));
    });
    return this.signIn.holds(token) ? pullRequest : null;
  }

  public async readMergeTypesAsync(reference: HostReference, signal: AbortSignal): Promise<readonly string[] | null> {
    const token: AzureCredential | null = this.tokenOf(reference);
    if (token === null)
      return null;
    const types: readonly string[] | null = await this.askAsync(token, async () => {
      const pull: JsonReader | null = await this.api.getAsync(Resources.formatPullRequestUrl(reference.owner, reference.repository, reference.number),
        token, signal);
      if (pull === null)
        return null;
      const project: string = AzureApi.read(() => pull.readObject(Resources.repositoryField).readObject(Resources.projectField).readNonBlankString(Resources.idField));
      return this.readAllowedMergeTypesAsync(reference.owner, project, reference.number, token, signal);
    });
    return this.signIn.holds(token) ? types : null;
  }

  public async readAllowedMergeTypesAsync(organization: string, project: string, number: number, token: AzureCredential,
    signal: AbortSignal): Promise<readonly string[]> {
    const evaluations: JsonReader | null = await this.api.getAsync(Resources.formatPolicyEvaluationsUrl(organization, project, number), token, signal);
    return evaluations === null ? Resources.mergeTypes : AzureApi.read(() => AzureReads.mergeTypesOf(evaluations.readObjectArray(Resources.valueField)));
  }

  public async readPullRequestThreadsAsync(reference: HostReference, signal: AbortSignal): Promise<readonly HostThread[]> {
    const token: AzureCredential | null = this.tokenOf(reference);
    if (token === null)
      return [];
    const threads: readonly HostThread[] = await this.askAsync(token, async () => {
      const answer: JsonReader | null = await this.api.getAsync(Resources.formatPullRequestThreadsUrl(reference.owner, reference.repository, reference.number),
        token, signal);
      return answer === null ? [] : AzureApi.read(() => answer.readObjectArray(Resources.valueField).flatMap(AzureReads.threadOf));
    });
    return this.signIn.holds(token) ? threads : [];
  }

  public async readPullRequestCommitsAsync(reference: HostReference, signal: AbortSignal): Promise<HostPullRequestCommits> {
    const none: HostPullRequestCommits = new HostPullRequestCommits([], false);
    const token: AzureCredential | null = this.tokenOf(reference);
    if (token === null)
      return none;
    const commits: HostPullRequestCommits = await this.askAsync(token, async () => {
      const answer: JsonReader | null = await this.api.getAsync(Resources.formatPullRequestCommitPageUrl(reference.owner, reference.repository, reference.number,
        HostPullRequestCommits.maximumCount + 1), token, signal);
      if (answer === null)
        return none;
      const read: readonly HostPullRequestCommit[] = AzureApi.read(() => answer.readObjectArray(Resources.valueField).map(AzureReads.pullRequestCommitOf));
      return new HostPullRequestCommits(read.slice(0, HostPullRequestCommits.maximumCount), read.length > HostPullRequestCommits.maximumCount);
    });
    return this.signIn.holds(token) ? commits : none;
  }

  public async readPullRequestUpdatesAsync(reference: HostReference, signal: AbortSignal): Promise<HostPullRequestUpdates> {
    const none: HostPullRequestUpdates = new HostPullRequestUpdates([], false);
    const token: AzureCredential | null = this.tokenOf(reference);
    if (token === null)
      return none;
    const updates: HostPullRequestUpdates = await this.askAsync(token, async () => {
      const answer: JsonReader | null = await this.api.getAsync(Resources.formatPullRequestIterationsUrl(reference.owner, reference.repository, reference.number), token,
        signal);
      if (answer === null)
        return none;
      const read: readonly HostPullRequestUpdate[] = AzureApi.read(() => answer.readObjectArray(Resources.valueField).map(AzureReads.pullRequestUpdateOf)).reverse();
      return new HostPullRequestUpdates(read.slice(0, HostPullRequestUpdates.maximumCount), read.length > HostPullRequestUpdates.maximumCount);
    });
    return this.signIn.holds(token) ? updates : none;
  }

  public async readPullRequestChangesAsync(reference: HostReference, signal: AbortSignal): Promise<HostPullRequestFiles> {
    const none: HostPullRequestFiles = new HostPullRequestFiles(null, null, [], false);
    const token: AzureCredential | null = this.tokenOf(reference);
    if (token === null)
      return none;
    const files: HostPullRequestFiles | null = await this.askAsync(token, () => this.readFilesAsync(reference, token, signal));
    return this.signIn.holds(token) && files !== null ? files : none;
  }

  private async readFilesAsync(reference: HostReference, token: AzureCredential, signal: AbortSignal): Promise<HostPullRequestFiles | null> {
    const latest: HostPullRequestUpdate | undefined = await this.readLatestAsync(reference, token, signal);
    if (latest === undefined)
      return null;
    const files: HostPullRequestFile[] = [];
    let skip: number | null = 0;
    while (skip !== null && files.length <= HostPullRequestFiles.maximumCount) {
      const answer: JsonReader | null = await this.api.getAsync(Resources.formatPullRequestChangesUrl(reference.owner, reference.repository, reference.number,
        latest.number, Resources.changesPage, skip), token, signal);
      if (answer === null)
        return null;
      const entries: readonly JsonReader[] = AzureApi.read(() => answer.readObjectArray(Resources.changeEntriesField));
      files.push(...AzureApi.read(() => AzureReads.changedFilesOf(entries)));
      skip = entries.length < Resources.changesPage ? null : skip + Resources.changesPage;
    }
    return new HostPullRequestFiles(latest.sourceCommit, latest.commonCommit, files.slice(0, HostPullRequestFiles.maximumCount),
      files.length > HostPullRequestFiles.maximumCount);
  }

  private async readLatestAsync(reference: HostReference, token: AzureCredential, signal: AbortSignal): Promise<HostPullRequestUpdate | undefined> {
    const iterations: JsonReader | null = await this.api.getAsync(Resources.formatPullRequestIterationsUrl(reference.owner, reference.repository, reference.number),
      token, signal);
    return iterations === null ? undefined : AzureApi.read(() => iterations.readObjectArray(Resources.valueField).map(AzureReads.pullRequestUpdateOf)).at(-1);
  }

  private static changedFilesOf(entries: readonly JsonReader[]): readonly HostPullRequestFile[] {
    return entries.filter(t => t.readObject(Resources.itemField).readOptionalString(Resources.gitObjectTypeField) !== Resources.treeObjectType)
      .flatMap(AzureReads.pullRequestFilesOf);
  }

  private async readCountsAsync(reference: HostReference, project: string, token: AzureCredential, signal: AbortSignal)
    : Promise<ChangeCounts | null> {
    try {
      const list: HostPullRequestFiles | null = await this.readFilesAsync(reference, token, signal);
      if (list === null || list.hasMore || list.commonCommit === null || list.sourceCommit === null)
        return null;
      const { commonCommit, sourceCommit, files } = list;
      const batches: (readonly HostPullRequestFile[])[] = [];
      for (let i = 0; i < files.length; i += Resources.fileDiffsBatch)
        batches.push(files.slice(i, i + Resources.fileDiffsBatch));
      const lines: readonly LineCounts[] = await Promise.all(batches.map(batch =>
        this.readLinesAsync(reference, project, commonCommit, sourceCommit, batch, token, signal)));
      const sum: LineCounts = AzureReads.sumOf(lines);
      return new ChangeCounts(sum.added, sum.removed, files.length);
    }
    catch (error) {
      if (!(error instanceof MethodFailureException && Resources.unansweredFailures.includes(error.failure.code)))
        throw error;
      this.log.write(Resources.formatCountsUnknown(reference.number, error.failure.message));
      return null;
    }
  }

  private async readLinesAsync(reference: HostReference, project: string, base: string, head: string, files: readonly HostPullRequestFile[], token: AzureCredential,
    signal: AbortSignal): Promise<LineCounts> {
    try {
      const answer: JsonReader | null = await this.api.postAsync(Resources.formatFileDiffsUrl(reference.owner, project, reference.repository), token, {
        [Resources.baseVersionCommitField]: base, [Resources.targetVersionCommitField]: head, [Resources.fileDiffParamsField]: files.map(AzureReads.fileDiffParamsOf)
      }, signal);
      if (answer === null)
        throw AzureApi.failure(FailureCode.Unavailable, Resources.fileDiffsNotFoundMessage);
      return AzureApi.read(() => AzureReads.linesOf(answer.readObjectArray(Resources.valueField)));
    }
    catch (error) {
      if (!(error instanceof MethodFailureException && error.failure.code === FailureCode.Unavailable))
        throw error;
      if (files.length === 1)
        throw error;
      const half: number = Math.ceil(files.length / 2);
      const halves: readonly LineCounts[] = await Promise.all([files.slice(0, half), files.slice(half)]
        .map(t => this.readLinesAsync(reference, project, base, head, t, token, signal)));
      return AzureReads.sumOf(halves);
    }
  }

  private static sumOf(lines: readonly LineCounts[]): LineCounts {
    return new LineCounts(lines.reduce((sum, t) => sum + t.added, 0), lines.reduce((sum, t) => sum + t.removed, 0));
  }

  private static fileDiffParamsOf(file: HostPullRequestFile): JsonValue {
    const path: string = Resources.formatAzurePath(file.path);
    if (file.kind === FileChangeKind.Added)
      return { [Resources.pathField]: path };
    if (file.kind === FileChangeKind.Deleted)
      return { [Resources.originalPathField]: path };
    return { [Resources.pathField]: path, [Resources.originalPathField]: Resources.formatAzurePath(file.previousPath ?? file.path) };
  }

  private static linesOf(files: readonly JsonReader[]): LineCounts {
    let added: number = 0;
    let removed: number = 0;
    for (const block of files.flatMap(t => t.hasField(Resources.lineDiffBlocksField) ? t.readObjectArray(Resources.lineDiffBlocksField) : [])) {
      const change: string = block.readString(Resources.changeTypeField).toLowerCase();
      if (change === Resources.addBlock || change === Resources.editBlock)
        added += block.readInteger(Resources.modifiedLinesCountField);
      if (change === Resources.deleteBlock || change === Resources.editBlock)
        removed += block.readInteger(Resources.originalLinesCountField);
    }
    return new LineCounts(added, removed);
  }

  public async readPullRequestConflictsAsync(reference: HostReference, signal: AbortSignal): Promise<HostPullRequestConflicts> {
    const none: HostPullRequestConflicts = new HostPullRequestConflicts([], false);
    const token: AzureCredential | null = this.tokenOf(reference);
    if (token === null)
      return none;
    const conflicts: HostPullRequestConflicts = await this.askAsync(token, async () => {
      const answer: JsonReader | null = await this.api.getAsync(Resources.formatPullRequestConflictsUrl(reference.owner, reference.repository, reference.number,
        HostPullRequestConflicts.maximumCount + 1), token, signal);
      if (answer === null)
        return none;
      const read: readonly string[] = AzureApi.read(() => answer.readObjectArray(Resources.valueField)
        .map(t => AzureReads.repositoryPathOf(t.readString(Resources.conflictPathField))));
      return new HostPullRequestConflicts(read.slice(0, HostPullRequestConflicts.maximumCount), read.length > HostPullRequestConflicts.maximumCount);
    });
    return this.signIn.holds(token) ? conflicts : none;
  }

  public async searchPeopleAsync(query: PeopleQuery, signal: AbortSignal): Promise<readonly FoundPerson[]> {
    const token: AzureCredential | null = this.signIn.tokenFor(query.reference.owner);
    if (token === null)
      return [];
    const found: readonly FoundPerson[] = await this.askAsync(token, async () => {
      const answer: JsonReader | null = await this.api.postAsync(Resources.formatSubjectQueryUrl(query.reference.owner), token,
        { [Resources.queryField]: query.query, [Resources.subjectKindField]: [Resources.userKind, Resources.groupKind] }, signal);
      return answer === null ? [] : AzureApi.read(() => answer.readObjectArray(Resources.valueField).slice(0, Resources.maximumPeopleFound)
        .map(t => new FoundPerson(t.readNonBlankString(Resources.descriptorField), t.readNonBlankString(Resources.displayNameField),
          t.readNonBlankString(Resources.principalNameField), t.readNonBlankString(Resources.subjectKindField).toLowerCase() === Resources.groupKind.toLowerCase())));
    }, Resources.cannotReadPeopleMessage);
    return this.signIn.holds(token) ? found : [];
  }

  public async readBranchPullRequestAsync(query: BranchQuery, signal: AbortSignal): Promise<BranchPullRequest> {
    const none: BranchPullRequest = new BranchPullRequest(null, []);
    const repository: AzureRepository | null = AzureRepository.parse(query.host, query.path);
    const token: AzureCredential | null = repository === null ? null : this.signIn.tokenFor(repository.organization, query.host, query.path);
    if (token === null || repository === null)
      return none;
    const answer: BranchPullRequest = await this.askAsync(token, async () => {
      const list: JsonReader | null = await this.api.getAsync(Resources.formatBranchPullRequestsUrl(repository.organization, repository.project,
        repository.name, query.branch), token, signal);
      const pull: JsonReader | undefined = list === null ? undefined : AzureApi.read(() => list.readObjectArray(Resources.valueField))[0];
      return pull === undefined ? none : await this.answerOfAsync(query, repository.organization, pull, token, signal);
    });
    return this.signIn.holds(token) ? answer : none;
  }

  public async readCommitPullRequestAsync(query: CommitQuery, signal: AbortSignal): Promise<BranchPullRequest> {
    const none: BranchPullRequest = new BranchPullRequest(null, []);
    const repository: AzureRepository | null = AzureRepository.parse(query.host, query.path);
    const token: AzureCredential | null = repository === null ? null : this.signIn.tokenFor(repository.organization, query.host, query.path);
    if (token === null || repository === null)
      return none;
    const answer: BranchPullRequest = await this.askAsync(token, async () => {
      const pull: JsonReader | null = await this.readCommitPullAsync(repository, query.commit, token, signal);
      return pull === null ? none : await this.answerOfAsync(query, repository.organization, pull, token, signal);
    });
    return this.signIn.holds(token) ? answer : none;
  }

  public async readCommitCommentsAsync(query: CommitQuery, signal: AbortSignal): Promise<HostCommitComments> {
    const none: HostCommitComments = HostCommitComments.none();
    const repository: AzureRepository | null = AzureRepository.parse(query.host, query.path);
    const token: AzureCredential | null = repository === null ? null : this.signIn.tokenFor(repository.organization, query.host, query.path);
    if (token === null || repository === null)
      return none;
    const answer: HostCommitComments = await this.askAsync(token, async () => {
      const pull: JsonReader | null = await this.readCommitPullAsync(repository, query.commit, token, signal);
      if (pull === null)
        return none;
      const item: HostItem = this.noted(query.host, query.path, AzureApi.read(() => AzureReads.itemOf(repository.organization, pull)));
      const [iterations, threads] = await Promise.all([
        this.api.getAsync(Resources.formatPullRequestIterationsUrl(repository.organization, item.reference.repository, item.reference.number), token, signal),
        this.api.getAsync(Resources.formatPullRequestThreadsUrl(repository.organization, item.reference.repository, item.reference.number), token, signal)]);
      return iterations === null || threads === null ? none : AzureApi.read(() => AzureReads.commitCommentsOf(query.commit, item.url,
        iterations.readObjectArray(Resources.valueField), threads.readObjectArray(Resources.valueField)));
    });
    return this.signIn.holds(token) ? answer : none;
  }

  public async readPullRequestsAsync(query: RepositoryQuery, signal: AbortSignal): Promise<HostPullRequestList> {
    if (!this.signIn.isSignedIn)
      return HostPullRequestList.signedOut();
    const repository: AzureRepository | null = AzureRepository.parse(query.host, query.path);
    const token: AzureCredential | null = repository === null ? null : this.signIn.tokenFor(repository.organization, query.host, query.path);
    if (token === null || repository === null)
      return new HostPullRequestList([], false);
    const list: HostPullRequestList = await this.askAsync(token, async () => {
      const read: readonly JsonReader[] = await this.readActiveAsync(repository, HostPullRequestList.maximumRows, token, signal);
      const rows: HostPullRequestRow[] = await Promise.all(read.slice(0, HostPullRequestList.maximumRows).map(async pull => {
        const item: HostItem = this.noted(query.host, query.path, AzureApi.read(() => AzureReads.itemOf(repository.organization, pull)));
        const checks: readonly HostCheck[] = await this.readChecksAsync(item, pull, token, signal);
        return HostPullRequestRow.of(item.reference, item.title, item.url, item.state === ReferenceState.Draft,
          AzureReads.votesOf(pull).filter(t => t > 0).length, checks, AzureApi.read(() => AzureReads.branchOf(pull.readString(Resources.sourceRefNameField))),
          AzureApi.read(() => AzureReads.branchOf(pull.readString(Resources.targetRefNameField))));
      }));
      return new HostPullRequestList(rows, read.length > HostPullRequestList.maximumRows);
    });
    return this.signIn.holds(token) ? list : HostPullRequestList.signedOut();
  }

  public async readPullRequestHeadsAsync(query: RepositoryQuery, signal: AbortSignal): Promise<HostPullRequestHeads> {
    if (!this.signIn.isSignedIn)
      return HostPullRequestHeads.signedOut();
    const repository: AzureRepository | null = AzureRepository.parse(query.host, query.path);
    const token: AzureCredential | null = repository === null ? null : this.signIn.tokenFor(repository.organization, query.host, query.path);
    if (token === null || repository === null)
      return new HostPullRequestHeads([], false);
    const heads: HostPullRequestHeads = await this.askAsync(token, async () => {
      const read: readonly JsonReader[] = await this.readActiveAsync(repository, HostPullRequestHeads.maximumRows, token, signal);
      return new HostPullRequestHeads(AzureApi.read(() => read.slice(0, HostPullRequestHeads.maximumRows).map(pull => {
        const item: HostItem = this.noted(query.host, query.path, AzureReads.itemOf(repository.organization, pull));
        return new HostPullRequestHead(item.reference, item.title, item.url, AzureReads.branchOf(pull.readString(Resources.sourceRefNameField)),
          AzureReads.branchOf(pull.readString(Resources.targetRefNameField)));
      })), read.length > HostPullRequestHeads.maximumRows);
    });
    return this.signIn.holds(token) ? heads : HostPullRequestHeads.signedOut();
  }

  private async readActiveAsync(repository: AzureRepository, limit: number, token: AzureCredential, signal: AbortSignal): Promise<readonly JsonReader[]> {
    const pulls: JsonReader | null = await this.api.getAsync(Resources.formatActivePullRequestsUrl(repository.organization, repository.project, repository.name,
      limit + 1), token, signal);
    return pulls === null ? [] : AzureApi.read(() => pulls.readObjectArray(Resources.valueField));
  }

  public async readReviewRequestsAsync(query: RepositoryQuery, signal: AbortSignal): Promise<HostReviewRequestList> {
    if (!this.signIn.isSignedIn)
      return HostReviewRequestList.signedOut();
    const repository: AzureRepository | null = AzureRepository.parse(query.host, query.path);
    const signedIn: readonly SignedInAccount[] = this.signIn.signedIn;
    const accounts: readonly SignedInAccount[] = repository === null ? [] : AzureReads.inOrganization(signedIn, repository.organization);
    if (repository === null || accounts.length === 0)
      return new HostReviewRequestList([], false);
    const settled: readonly PromiseSettledResult<AccountReviewRequests>[] = await AzureReads.inTurnAsync(accounts, async t =>
      new AccountReviewRequests(t, await this.readAccountReviewsAsync(query, repository, t, signedIn.length > 1, signal)));
    const held: readonly AccountReviewRequests[] = this.heldOf(settled);
    if (held.length === 0)
      return HostReviewRequestList.signedOut();
    const rows: readonly HostReviewRequest[] = held.flatMap(t => t.list.rows).toSorted((a, b) => b.createdAt - a.createdAt);
    return new HostReviewRequestList(rows.slice(0, HostReviewRequestList.maximumRows), rows.length > HostReviewRequestList.maximumRows
      || held.some(t => t.list.hasMore) || settled.some(t => t.status === "rejected"));
  }

  public async readWorkItemAsync(query: WorkItemQuery, signal: AbortSignal): Promise<HostWorkItem | null> {
    const token: AzureCredential | null = query.host === AzureDevOpsNames.moduleId ? this.signIn.tokenFor(query.organization) : null;
    if (token === null || !Resources.organizationPattern.test(query.organization))
      return null;
    const workItem: HostWorkItem | null = await this.askAsync(token, async () => {
      const found: JsonReader | null = await this.api.getAsync(Resources.formatWorkItemUrl(query.organization, query.id), token, signal);
      if (found === null)
        return null;
      const fields: JsonReader = AzureApi.read(() => found.readObject(Resources.fieldsField));
      const project: string = AzureApi.read(() => fields.readNonBlankString(Resources.teamProjectField));
      const typeName: string = AzureApi.read(() => fields.readNonBlankString(Resources.workItemTypeField));
      const type = await this.readTypeAsync(query.organization, project, typeName, token, signal);
      return AzureApi.read(() => AzureReads.workItemOf(query.organization, query.id, project, fields, type));
    });
    return this.signIn.holds(token) ? workItem : null;
  }

  public async readWorkItemsAsync(query: WorkItemsQuery, signal: AbortSignal): Promise<HostWorkItemList> {
    const none: HostWorkItemList = new HostWorkItemList([], false);
    if (query.host !== AzureDevOpsNames.moduleId || !Resources.organizationPattern.test(query.organization))
      return none;
    if (query.scope === WorkItemScope.Ids) {
      const token: AzureCredential | null = this.signIn.tokenFor(query.organization);
      if (token === null)
        return none;
      const list: HostWorkItemList = await this.readListAsync(query, token, null, signal);
      return this.signIn.holds(token) ? list : none;
    }
    const signedIn: readonly SignedInAccount[] = this.signIn.signedIn;
    const accounts: readonly SignedInAccount[] = AzureReads.inOrganization(signedIn, query.organization);
    if (accounts.length === 0)
      return none;
    const settled: readonly PromiseSettledResult<AccountWorkItems>[] = await AzureReads.inTurnAsync(accounts, async t =>
      new AccountWorkItems(t, await this.readListAsync(query, t.token, signedIn.length > 1 ? t.login : null, signal)));
    const held: readonly AccountWorkItems[] = this.heldOf(settled);
    const details: Map<number, HostWorkItemDetail> = new Map();
    for (const detail of held.flatMap(t => t.list.items))
      if (!details.has(detail.item.id))
        details.set(detail.item.id, detail);
    return new HostWorkItemList(AzureReads.treeOf([...details.values()]), held.some(t => t.list.isTruncated));
  }

  private async readListAsync(query: WorkItemsQuery, token: AzureCredential, account: string | null, signal: AbortSignal): Promise<HostWorkItemList> {
    return this.askAsync(token, async () => {
      const queried: QueriedIds = await this.queryIdsAsync(query, token, signal);
      const found: readonly JsonReader[] = await this.readBatchAsync(query.organization, queried.ids, token, signal);
      const items: readonly JsonReader[] = query.scope === WorkItemScope.Mine ? await this.withAncestorsAsync(query.organization, found, token, signal) : found;
      const details: HostWorkItemDetail[] = [];
      for (const item of items)
        details.push(await this.detailOfAsync(query.organization, item, token, signal, account));
      return new HostWorkItemList(AzureReads.treeOf(details), queried.isTruncated);
    });
  }

  private async readAccountReviewsAsync(query: RepositoryQuery, repository: AzureRepository, account: SignedInAccount, isNamed: boolean,
    signal: AbortSignal): Promise<HostReviewRequestList> {
    const token: AzureCredential = account.token;
    return this.askAsync(token, async () => {
      const reviewer: string = await this.readReviewerAsync(repository.organization, token, signal);
      const pulls: JsonReader | null = await this.api.getAsync(Resources.formatReviewRequestsUrl(repository.organization, repository.project, repository.name,
        reviewer), token, signal);
      const read: readonly JsonReader[] = pulls === null ? [] : AzureApi.read(() => pulls.readObjectArray(Resources.valueField));
      const asked: readonly HostReviewRequest[] = AzureApi.read(() => read.filter(t => AzureReads.waitsOn(t, reviewer))
        .map(t => this.noted(query.host, query.path, AzureReads.reviewRequestOf(repository.organization, t, isNamed ? account.login : null))));
      return new HostReviewRequestList(asked.slice(0, HostReviewRequestList.maximumRows).toSorted((a, b) => b.createdAt - a.createdAt),
        read.length > HostReviewRequestList.maximumRows);
    });
  }

  private heldOf<T extends { readonly account: SignedInAccount }>(settled: readonly PromiseSettledResult<T>[]): readonly T[] {
    const read: readonly T[] = settled.flatMap(t => t.status === "fulfilled" ? [t.value] : []);
    const failures: readonly unknown[] = settled.flatMap((t): unknown[] => t.status === "rejected" ? [t.reason] : []);
    const unexpected: readonly unknown[] = failures.filter(t => !(t instanceof MethodFailureException));
    if (unexpected.length > 0 || read.length === 0)
      throw unexpected[0] ?? failures[0];
    return read.filter(t => this.signIn.holds(t.account.token));
  }

  public async readDetailAsync(organization: string, answer: JsonReader, token: AzureCredential, signal: AbortSignal): Promise<HostWorkItemDetail> {
    return this.askAsync(token, () => this.detailOfAsync(organization, answer, token, signal));
  }

  private async queryIdsAsync(query: WorkItemsQuery, token: AzureCredential, signal: AbortSignal): Promise<QueriedIds> {
    if (query.scope === WorkItemScope.Ids)
      return new QueriedIds(query.ids, false);
    const closed: readonly string[] = await this.readClosedStatesAsync(query.organization, query.project, token, signal);
    return this.queryAsync(Resources.formatWiqlUrl(query.organization, query.project), Resources.formatMineQuery(closed), token, signal);
  }

  private async queryAsync(url: string, wiql: string, token: AzureCredential, signal: AbortSignal): Promise<QueriedIds> {
    const answer: JsonReader | null = await this.api.postAsync(url, token, { [Resources.queryField]: wiql }, signal);
    const ids: readonly number[] = answer === null ? [] : AzureApi.read(() => answer.readObjectArray(Resources.workItemsField).map(t => t.readInteger(Resources.idField)));
    return new QueriedIds(ids, ids.length >= Resources.batchSize);
  }

  private async readClosedStatesAsync(organization: string, project: string, token: AzureCredential, signal: AbortSignal): Promise<readonly string[]> {
    const answer: JsonReader | null = await this.api.getAsync(Resources.formatWorkItemTypesUrl(organization, project), token, signal);
    return answer === null ? [] : AzureApi.read(() => [...new Set(answer.readObjectArray(Resources.valueField).flatMap(t => t.readObjectArray(Resources.statesField))
      .filter(t => Resources.closedCategories.includes(t.readOneOf(Resources.categoryField, Resources.workItemCategories)))
      .map(t => t.readString(Resources.nameField)))]);
  }

  private async readBatchAsync(organization: string, ids: readonly number[], token: AzureCredential, signal: AbortSignal): Promise<readonly JsonReader[]> {
    const read: JsonReader[] = [];
    for (let start = 0; start < ids.length; start += Resources.batchSize) {
      const answer: JsonReader | null = await this.api.postAsync(Resources.formatWorkItemsBatchUrl(organization), token, {
        [Resources.idsField]: ids.slice(start, start + Resources.batchSize), [Resources.expandField]: Resources.relationsExpand,
        [Resources.errorPolicyField]: Resources.omitErrorPolicy
      }, signal);
      if (answer !== null)
        read.push(...AzureApi.read(() => AzureReads.foundOf(answer)));
    }
    return read;
  }

  private async withAncestorsAsync(organization: string, found: readonly JsonReader[], token: AzureCredential,
    signal: AbortSignal): Promise<readonly JsonReader[]> {
    const items: JsonReader[] = [...found];
    const asked: Set<number> = new Set(AzureApi.read(() => items.map(t => t.readInteger(Resources.idField))));
    let missing: readonly number[] = AzureReads.missingParentsOf(items, asked);
    while (missing.length > 0) {
      for (const id of missing)
        asked.add(id);
      items.push(...await this.readBatchAsync(organization, missing, token, signal));
      missing = AzureReads.missingParentsOf(items, asked);
    }
    return items;
  }

  private async detailOfAsync(organization: string, answer: JsonReader, token: AzureCredential, signal: AbortSignal,
    account: string | null = null): Promise<HostWorkItemDetail> {
    const fields: JsonReader = AzureApi.read(() => answer.readObject(Resources.fieldsField));
    const project: string = AzureApi.read(() => fields.readNonBlankString(Resources.teamProjectField));
    const type = await this.readTypeAsync(organization, project, AzureApi.read(() => fields.readNonBlankString(Resources.workItemTypeField)), token, signal);
    return AzureApi.read(() => AzureReads.detailOf(organization, answer, project, fields, type, account));
  }

  private async readTypeAsync(organization: string, project: string, name: string, token: AzureCredential,
    signal: AbortSignal): Promise<WorkItemTypeStates> {
    if (this.typesToken !== token) {
      this.types.clear();
      this.typesToken = token;
    }
    const key: string = Resources.formatWorkItemTypeKey(organization, project, name);
    let reading = this.types.get(key);
    if (reading === undefined) {
      const read = this.readNewTypeAsync(organization, project, name, token);
      reading = read;
      this.types.set(key, read);
      read.catch(() => {
        if (this.types.get(key) === read)
          this.types.delete(key);
      });
    }
    const type = await reading;
    signal.throwIfAborted();
    return type;
  }

  private async readNewTypeAsync(organization: string, project: string, name: string,
    token: AzureCredential): Promise<WorkItemTypeStates> {
    const answer: JsonReader | null = await this.api.getAsync(Resources.formatWorkItemTypeUrl(organization, project, name), token, AzureReads.unstopped);
    if (answer === null)
      throw AzureApi.failure(FailureCode.Unavailable, Resources.unreadableAnswerMessage);
    const { type: read, categories } = AzureApi.read(() => AzureReads.typeOf(answer));
    const dropped = (reason: string): void => this.log.write(Resources.formatIconDropped(read.icon, reason));
    let image: string | null;
    try {
      image = await this.api.getSvgAsync(Resources.formatWorkItemIconUrl(organization, read.icon, read.color), token, AzureReads.unstopped, dropped);
    }
    catch (error) {
      if (!(error instanceof MethodFailureException && Resources.unansweredFailures.includes(error.failure.code)))
        throw error;
      dropped(Resources.iconUnanswered);
      image = null;
    }
    return new WorkItemTypeStates(new HostWorkItemType(read.name, read.color, read.icon, image), categories);
  }

  private async readChecksAsync(item: HostItem, pull: JsonReader, token: AzureCredential, signal: AbortSignal): Promise<readonly HostCheck[]> {
    const project: string = AzureApi.read(() => pull.readObject(Resources.repositoryField).readObject(Resources.projectField).readNonBlankString(Resources.idField));
    const [policies, builds] = await Promise.all([this.readPoliciesAsync(item, project, token, signal), this.readBuildsAsync(item, project, token, signal)]);
    return [...builds.map(t => AzureReads.checkOfBuild(t.build, item)), ...policies.filter(t => !t.isBuild).map(t => AzureReads.checkOfPolicy(t.policy))];
  }

  private async readCommitCountAsync(reference: HostReference, token: AzureCredential, signal: AbortSignal): Promise<number | null> {
    const commits: JsonReader | null = await this.api.getAsync(Resources.formatPullRequestCommitsUrl(reference.owner, reference.repository, reference.number),
      token, signal);
    const count: number | null = commits === null ? null : AzureApi.read(() => commits.readObjectArray(Resources.valueField).length);
    return count !== null && count < Resources.commitsPageSize ? count : null;
  }

  private async readWorkItemLinksAsync(reference: HostReference, token: AzureCredential, signal: AbortSignal): Promise<readonly HostWorkItemLink[]> {
    const links: JsonReader | null = await this.api.getAsync(Resources.formatPullRequestWorkItemsUrl(reference.owner, reference.repository, reference.number),
      token, signal);
    const ids: readonly number[] = links === null ? [] : AzureApi.read(() => links.readObjectArray(Resources.valueField).map(AzureReads.workItemIdOf));
    if (ids.length === 0)
      return [];
    const items: readonly JsonReader[] = await this.readBatchAsync(reference.owner, ids, token, signal);
    const read: HostWorkItemLink[] = [];
    for (const item of items) {
      const fields: JsonReader = AzureApi.read(() => item.readObject(Resources.fieldsField));
      const project: string = AzureApi.read(() => fields.readNonBlankString(Resources.teamProjectField));
      const { type, categories } = await this.readTypeAsync(reference.owner, project, AzureApi.read(() => fields.readNonBlankString(Resources.workItemTypeField)),
        token, signal);
      read.push(AzureApi.read(() => {
        const id: number = item.readInteger(Resources.idField);
        const state: string = fields.readNonBlankString(Resources.workItemStateField);
        return new HostWorkItemLink(id, fields.readNonBlankString(Resources.workItemTitleField), type, state, categories.get(state) ?? WorkItemCategory.Proposed,
          Resources.formatWorkItemPage(reference.owner, project, id));
      }));
    }
    return read;
  }

  private async readPoliciesAsync(item: HostItem, project: string, token: AzureCredential,
    signal: AbortSignal): Promise<readonly EvaluatedPolicy[]> {
    const evaluations: JsonReader | null = await this.api.getAsync(Resources.formatPolicyEvaluationsUrl(item.reference.owner, project, item.reference.number),
      token, signal);
    const read = evaluations === null ? [] : AzureApi.read(() => evaluations.readObjectArray(Resources.valueField).map(AzureReads.policyOf));
    return item.closedAt === null ? read : read.map(t => new EvaluatedPolicy(AzureReads.closedPolicyOf(t.policy), t.isBuild, t.buildId));
  }

  private async readBuildsAsync(item: HostItem, project: string, token: AzureCredential,
    signal: AbortSignal): Promise<readonly RanBuild[]> {
    const { owner, repository, number } = item.reference;
    const builds: JsonReader | null = await this.api.getAsync(Resources.formatBuildsUrl(owner, project, repository, number), token, signal);
    return builds === null ? [] : AzureApi.read(() => builds.readObjectArray(Resources.valueField).map(AzureReads.buildOf));
  }

  private async readCommitPullAsync(repository: AzureRepository, commit: string, token: AzureCredential, signal: AbortSignal): Promise<JsonReader | null> {
    const found: JsonReader | null = await this.api.postAsync(Resources.formatPullRequestQueryUrl(repository.organization, repository.project, repository.name),
      token, { [Resources.queriesField]: [Resources.commitQueryType, Resources.lastMergeCommitQueryType]
        .map(t => ({ [Resources.typeField]: t, [Resources.itemsField]: [commit] })) }, signal);
    const number: number | undefined = found === null ? undefined : AzureApi.read(() => found.readObjectArray(Resources.resultsField)
      .flatMap(t => t.hasField(commit) ? t.readObjectArray(commit) : []).map(t => t.readInteger(Resources.pullRequestIdField))[0]);
    return number === undefined ? null
      : await this.api.getAsync(Resources.formatProjectPullRequestUrl(repository.organization, repository.project, number), token, signal);
  }

  private async answerOfAsync(query: CommitQuery | BranchQuery, organization: string, pull: JsonReader, token: AzureCredential,
    signal: AbortSignal): Promise<BranchPullRequest> {
    const item: HostItem = this.noted(query.host, query.path, AzureApi.read(() => AzureReads.itemOf(organization, pull)));
    const votes: readonly number[] = AzureReads.votesOf(pull);
    return new BranchPullRequest(item, await this.readChecksAsync(item, pull, token, signal), AzureReads.decisionOf(votes), votes.filter(t => t > 0).length);
  }

  private async readReviewerAsync(organization: string, token: AzureCredential, signal: AbortSignal): Promise<string> {
    const known: KnownReviewer | undefined = this.reviewers.find(t => t.token === token);
    if (known !== undefined)
      return known.id;
    const connection: JsonReader | null = await this.api.getAsync(Resources.formatConnectionDataUrl(organization), token, signal);
    if (connection === null)
      throw AzureApi.failure(FailureCode.Unavailable, Resources.unreadableAnswerMessage);
    const id: string = AzureApi.read(() => connection.readObject(Resources.authenticatedUserField).readNonBlankString(Resources.idField));
    if (this.signIn.holds(token))
      this.reviewers = [...this.reviewers.filter(t => this.signIn.holds(t.token)), new KnownReviewer(token, id)];
    return id;
  }

  private async askAsync<T>(token: AzureCredential, ask: () => Promise<T>, cannotRead: string | null = null): Promise<T> {
    await this.signIn.readyAsync();
    try {
      return await ask();
    }
    catch (error) {
      if (!AzureApi.isUnauthorized(error))
        throw error;
      await this.signIn.refusedAsync(token);
      throw cannotRead !== null && this.signIn.holds(token) ? AzureApi.failure(FailureCode.Unauthorized, cannotRead) : error;
    }
  }

  private static async inTurnAsync<T>(accounts: readonly SignedInAccount[],
    read: (account: SignedInAccount) => Promise<T>): Promise<readonly PromiseSettledResult<T>[]> {
    const settled: PromiseSettledResult<T>[] = [];
    for (const account of accounts)
      settled.push(await read(account).then((value): PromiseSettledResult<T> => ({ status: "fulfilled", value }),
        (reason: unknown): PromiseSettledResult<T> => ({ status: "rejected", reason })));
    return settled;
  }

  private static inOrganization(accounts: readonly SignedInAccount[], organization: string): readonly SignedInAccount[] {
    return accounts.filter(t => Resources.isSameOrganization(t.organization, organization));
  }

  private static waitsOn(pull: JsonReader, reviewer: string): boolean {
    return pull.readObjectArray(Resources.reviewersField).some(t => t.hasField(Resources.idField) && t.readString(Resources.idField) === reviewer
      && t.readInteger(Resources.voteField) === 0);
  }

  private static reviewRequestOf(organization: string, pull: JsonReader, account: string | null): HostReviewRequest {
    const item: HostItem = AzureReads.itemOf(organization, pull);
    return new HostReviewRequest(item.reference, item.title, item.url, item.state === ReferenceState.Draft, item.createdAt, account);
  }

  public repositoryOf(reference: HostReference): readonly [string, string] | null {
    return this.repositories.get(AzureReads.keyOf(reference)) ?? null;
  }

  private tokenOf(reference: HostReference): AzureCredential | null {
    const [host, path] = this.repositoryOf(reference) ?? [null, null];
    return Resources.isOwnReference(reference) ? this.signIn.tokenFor(reference.owner, host, path) : null;
  }

  private noted<T extends { readonly reference: HostReference }>(host: string, path: string, read: T): T {
    this.repositories.set(AzureReads.keyOf(read.reference), [host, path]);
    return read;
  }

  private static keyOf(reference: HostReference): string {
    return [reference.owner, reference.repository].join(Resources.pathSeparator).toLowerCase();
  }

  private static itemOf(organization: string, pull: JsonReader, counts: ChangeCounts | null = null): HostItem {
    const repository: JsonReader = pull.readObject(Resources.repositoryField);
    const number: number = pull.readInteger(Resources.pullRequestIdField);
    const status: string = pull.readString(Resources.statusField);
    const state: ReferenceState = status === Resources.completedStatus ? ReferenceState.Merged : status === Resources.abandonedStatus ? ReferenceState.Closed
      : pull.readBoolean(Resources.isDraftField) ? ReferenceState.Draft : ReferenceState.Open;
    const closedAt: number | null = state === ReferenceState.Merged || state === ReferenceState.Closed ? Date.parse(pull.readString(Resources.closedDateField))
      : null;
    const creator: JsonReader | null = pull.hasField(Resources.createdByField) ? pull.readObject(Resources.createdByField) : null;
    const head: string = AzureReads.branchOf(pull.readString(Resources.sourceRefNameField));
    const base: string = AzureReads.branchOf(pull.readString(Resources.targetRefNameField));
    const commit: string = pull.readObject(Resources.lastMergeSourceCommitField).readString(Resources.commitIdField);
    const changes: HostChanges = counts === null ? HostChanges.uncounted(head, base, commit) : new HostChanges(counts.added, counts.removed, counts.files, head, base, commit);
    const url: string = Resources.formatPullRequestPage(organization, repository.readObject(Resources.projectField).readString(Resources.nameField),
      repository.readString(Resources.nameField), number);
    return new HostItem(new HostReference(AzureDevOpsNames.moduleId, organization, repository.readString(Resources.idField), number), ReferenceKind.PullRequest,
      state, pull.readString(Resources.titleField), url, creator === null ? null : AzureReads.personOf(creator),
      Date.parse(pull.readString(Resources.creationDateField)), closedAt, 0, changes);
  }

  private static foundOf(answer: JsonReader): readonly JsonReader[] {
    const values: JsonValue = answer.readValue(Resources.valueField);
    return Array.isArray(values) ? values.filter(t => t !== null).map(t => JsonReader.fromValue(t, answer.path)) : answer.readObjectArray(Resources.valueField);
  }

  private static missingParentsOf(items: readonly JsonReader[], asked: ReadonlySet<number>): readonly number[] {
    return [...new Set(AzureApi.read(() => items.map(t => t.readObject(Resources.fieldsField)).filter(t => t.hasField(Resources.parentField))
      .map(t => t.readInteger(Resources.parentField))))].filter(t => !asked.has(t));
  }

  private static detailOf(organization: string, answer: JsonReader, project: string, fields: JsonReader,
    type: WorkItemTypeStates, account: string | null): HostWorkItemDetail {
    const id: number = answer.readInteger(Resources.idField);
    const relations: readonly JsonReader[] = answer.hasField(Resources.relationsField) ? answer.readObjectArray(Resources.relationsField) : [];
    const urls = (relation: string): readonly string[] => relations.filter(t => t.readString(Resources.relationField) === relation)
      .map(t => t.readString(Resources.urlField));
    const links: readonly string[] = urls(Resources.artifactLinkRelation);
    const number = (names: readonly string[]): number | null => names.filter(t => fields.hasField(t)).map(t => fields.readNumber(t))[0] ?? null;
    const children: readonly number[] = [...new Set(urls(Resources.childRelation).map(t => AzureReads.childOf(t)))];
    const pullRequests: readonly HostReference[] = links.filter(t => Resources.pullRequestArtifactPattern.test(t)).map(t => new HostReference(
      AzureDevOpsNames.moduleId, organization, t.replace(Resources.pullRequestArtifactPattern, Resources.firstGroup).toLowerCase(),
      Number(t.replace(Resources.pullRequestArtifactPattern, Resources.secondGroup))));
    const branches: readonly string[] = links.filter(t => Resources.branchArtifactPattern.test(t))
      .map(t => decodeURIComponent(t.replace(Resources.branchArtifactPattern, Resources.firstGroup)));
    return new HostWorkItemDetail(AzureReads.workItemOf(organization, id, project, fields, type), number(Resources.pointsFields),
      number([Resources.remainingWorkField]), number([Resources.completedWorkField]), number(Resources.orderFields),
      fields.hasField(Resources.acceptanceCriteriaField) ? AzureReads.plainTextOf(fields.readString(Resources.acceptanceCriteriaField)) : null, children,
      pullRequests, links.filter(t => t.startsWith(Resources.commitArtifactPrefix)).length, branches, null, account);
  }

  private static childOf(url: string): number {
    if (!Resources.childUrlPattern.test(url))
      throw AzureApi.failure(FailureCode.Unavailable, Resources.unreadableAnswerMessage);
    return Number(url.slice(url.lastIndexOf(Resources.pathSeparator) + 1));
  }

  private static plainTextOf(html: string): string | null {
    let text: string = html.replace(Resources.lineBreakPattern, Resources.newLine).replace(Resources.tagPattern, Resources.emptyText);
    for (const [entity, character] of Resources.entities)
      text = text.replaceAll(entity, character);
    text = text.replace(Resources.blankLinesPattern, Resources.paragraphBreak).trim();
    return text.length === 0 ? null : text;
  }

  private static treeOf(details: readonly HostWorkItemDetail[]): readonly HostWorkItemDetail[] {
    const ids: ReadonlySet<number> = new Set(details.map(t => t.item.id));
    const ordered: HostWorkItemDetail[] = [];
    const add = (parent: number | null): void => {
      for (const detail of details.filter(t => (t.item.parent !== null && ids.has(t.item.parent) ? t.item.parent : null) === parent)) {
        ordered.push(detail);
        add(detail.item.id);
      }
    };
    add(null);
    return ordered;
  }

  private static workItemIdOf(link: JsonReader): number {
    const id: string = link.readNonBlankString(Resources.idField);
    if (!Resources.workItemIdPattern.test(id))
      throw AzureApi.failure(FailureCode.Unavailable, Resources.unreadableAnswerMessage);
    return Number(id);
  }

  private static typeOf(answer: JsonReader): WorkItemTypeStates {
    const type: HostWorkItemType = new HostWorkItemType(answer.readNonBlankString(Resources.nameField), answer.readString(Resources.colorField),
      answer.readObject(Resources.iconField).readString(Resources.idField));
    return new WorkItemTypeStates(type, new Map(answer.readObjectArray(Resources.statesField).map(t => [t.readString(Resources.nameField),
      t.readOneOf(Resources.categoryField, Resources.workItemCategories)])));
  }

  private static workItemOf(organization: string, id: number, project: string, fields: JsonReader,
    { type, categories }: WorkItemTypeStates): HostWorkItem {
    const state: string = fields.readNonBlankString(Resources.workItemStateField);
    const text = (field: string): string | null => fields.hasField(field) ? fields.readNonBlankString(field) : null;
    return new HostWorkItem(AzureDevOpsNames.moduleId, organization, project, id, type, fields.readNonBlankString(Resources.workItemTitleField),
      state, categories.get(state) ?? WorkItemCategory.Proposed, Resources.formatWorkItemPage(organization, project, id),
      fields.hasField(Resources.assignedToField) ? AzureReads.personOf(fields.readObject(Resources.assignedToField)) : null,
      text(Resources.iterationPathField), text(Resources.areaPathField),
      fields.hasField(Resources.parentField) ? fields.readInteger(Resources.parentField) : null,
      fields.hasField(Resources.changedDateField) ? Date.parse(fields.readString(Resources.changedDateField)) : null);
  }

  private static threadOf(thread: JsonReader): readonly HostThread[] {
    if (AzureReads.isDeleted(thread))
      return [];
    const comments: readonly HostComment[] = thread.readObjectArray(Resources.commentsField).filter(AzureReads.isPersonText).map(AzureReads.commentOf);
    if (comments.length === 0)
      return [];
    const status: string | undefined = thread.readOptionalString(Resources.statusField);
    const context: JsonReader | null = thread.hasField(Resources.threadContextField) ? thread.readNullableObject(Resources.threadContextField) : null;
    const path: string | null = context === null ? null : context.readNullableString(Resources.filePathField);
    const line: number | null = context === null || path === null ? null
      : AzureReads.lineOf(context, Resources.rightFileStartField) ?? AzureReads.lineOf(context, Resources.leftFileStartField);
    return [new HostThread(thread.readInteger(Resources.idField), (status === undefined ? undefined : Resources.threadStates.get(status)) ?? ThreadStatus.None,
      path, line, comments)];
  }

  private static commitCommentsOf(commit: string, page: string, iterations: readonly JsonReader[], threads: readonly JsonReader[]): HostCommitComments {
    const made: readonly number[] = iterations.filter(t => t.readObject(Resources.sourceRefCommitField).readString(Resources.commitIdField) === commit)
      .map(t => t.readInteger(Resources.idField));
    const count: number = threads.filter(t => !AzureReads.isDeleted(t) && made.includes(AzureReads.threadIterationOf(t)))
      .reduce((total, t) => total + t.readObjectArray(Resources.commentsField).filter(AzureReads.isPersonText).length, 0);
    return count === 0 ? HostCommitComments.none() : new HostCommitComments(Math.min(count, HostCommitComments.maximumCount),
      count > HostCommitComments.maximumCount, Resources.formatIterationPage(page, Math.max(...made)));
  }

  private static threadIterationOf(thread: JsonReader): number {
    const context: JsonReader | null = thread.hasField(Resources.pullRequestThreadContextField) ? thread.readNullableObject(Resources.pullRequestThreadContextField)
      : null;
    const iteration: JsonReader | null = context !== null && context.hasField(Resources.iterationContextField)
      ? context.readNullableObject(Resources.iterationContextField) : null;
    return iteration === null ? 0 : iteration.readInteger(Resources.secondComparingIterationField);
  }

  private static lineOf(context: JsonReader, field: string): number | null {
    const start: JsonReader | null = context.hasField(field) ? context.readNullableObject(field) : null;
    return start === null ? null : start.readInteger(Resources.lineField);
  }

  private static isDeleted(value: JsonReader): boolean {
    return value.hasField(Resources.isDeletedField) && value.readBoolean(Resources.isDeletedField);
  }

  private static isPersonText(comment: JsonReader): boolean {
    return !AzureReads.isDeleted(comment) && comment.readOptionalString(Resources.commentTypeField) === Resources.textCommentType
      && (comment.readOptionalString(Resources.contentField) ?? "").trim().length > 0;
  }

  public static commentOf(comment: JsonReader): HostComment {
    const parent: number = comment.hasField(Resources.parentCommentIdField) ? comment.readInteger(Resources.parentCommentIdField) : 0;
    return new HostComment(comment.readInteger(Resources.idField), parent > 0 ? parent : null, AzureReads.personOf(comment.readObject(Resources.authorField)),
      Date.parse(comment.readString(Resources.publishedDateField)), comment.readString(Resources.contentField));
  }

  private static pullRequestCommitOf(commit: JsonReader): HostPullRequestCommit {
    const author: JsonReader = commit.readObject(Resources.authorField);
    const comment: string = commit.hasField(Resources.commentField) ? commit.readString(Resources.commentField) : "";
    const end: number = comment.search(Resources.subjectEndPattern);
    return new HostPullRequestCommit(commit.readString(Resources.commitIdField), end < 0 ? comment : comment.slice(0, end),
      author.readNonBlankString(Resources.nameField), Date.parse(author.readString(Resources.dateField)));
  }

  private static pullRequestUpdateOf(iteration: JsonReader): HostPullRequestUpdate {
    const common: string | null = iteration.hasField(Resources.commonRefCommitField)
      ? iteration.readObject(Resources.commonRefCommitField).readString(Resources.commitIdField) : null;
    return new HostPullRequestUpdate(iteration.readInteger(Resources.idField),
      iteration.hasField(Resources.authorField) ? AzureReads.personOf(iteration.readObject(Resources.authorField)) : null,
      Date.parse(iteration.readString(Resources.createdDateField)), iteration.readObject(Resources.sourceRefCommitField).readString(Resources.commitIdField), common);
  }

  private static textOf(reader: JsonReader, name: string): string | undefined {
    return reader.hasField(name) ? reader.readNullableString(name) ?? undefined : undefined;
  }

  private static pullRequestFilesOf(entry: JsonReader): readonly HostPullRequestFile[] {
    const current: string | undefined = AzureReads.textOf(entry.readObject(Resources.itemField), Resources.pathField);
    const original: string | undefined = AzureReads.textOf(entry, Resources.originalPathField);
    const named: string | undefined = current ?? original;
    if (named === undefined)
      return [];
    const path: string = AzureReads.repositoryPathOf(named);
    const types: readonly string[] = entry.readString(Resources.changeTypeField).split(Resources.changeTypeSeparator);
    if (types.includes(Resources.addChange))
      return [new HostPullRequestFile(path, FileChangeKind.Added, null)];
    if (types.includes(Resources.deleteChange))
      return [new HostPullRequestFile(path, FileChangeKind.Deleted, null)];
    return [types.includes(Resources.renameChange) && current !== undefined && original !== undefined
      ? new HostPullRequestFile(path, FileChangeKind.Renamed, AzureReads.repositoryPathOf(original)) : new HostPullRequestFile(path, FileChangeKind.Modified, null)];
  }

  private static repositoryPathOf(path: string): string {
    return path.replace(Resources.leadingSlashesPattern, Resources.emptyText);
  }

  private static personOf(identity: JsonReader): HostPerson {
    const name: string = identity.readOptionalString(Resources.displayNameField)?.trim() ?? "";
    return new HostPerson(identity.readNonBlankString(Resources.uniqueNameField), null, null, undefined, name.length > 0 ? name : null);
  }

  public static reviewerOf(reviewer: JsonReader): HostReviewer {
    const vote: number = reviewer.readInteger(Resources.voteField);
    const label: string | undefined = Resources.voteLabels.get(vote);
    return new HostReviewer(AzureReads.reviewingOf(reviewer), vote / Resources.fullVote, label ?? Resources.formatVote(vote),
      reviewer.hasField(Resources.isRequiredField) && reviewer.readBoolean(Resources.isRequiredField));
  }

  private static reviewingOf(reviewer: JsonReader): HostPerson {
    const name: string = reviewer.readOptionalString(Resources.displayNameField) ?? "";
    return AzureReads.isGroup(reviewer) && name.trim().length > 0 ? new HostPerson(name, null, null) : AzureReads.personOf(reviewer);
  }

  private static policyOf(evaluation: JsonReader): EvaluatedPolicy {
    const configuration: JsonReader = evaluation.readObject(Resources.configurationField);
    const type: JsonReader = configuration.readObject(Resources.typeField);
    const state: PolicyState | undefined = Resources.policyStates.get(evaluation.readString(Resources.statusField));
    const policy: HostPolicy = new HostPolicy(type.readString(Resources.displayNameField), state ?? PolicyState.Rejected,
      configuration.readBoolean(Resources.isBlockingField), null);
    const context: JsonReader | null = evaluation.hasField(Resources.evaluationContextField) ? evaluation.readNullableObject(Resources.evaluationContextField) : null;
    const buildId: number | null = context !== null && context.hasField(Resources.buildIdField) ? context.readNullableInteger(Resources.buildIdField) : null;
    return new EvaluatedPolicy(policy, type.readString(Resources.idField) === Resources.buildPolicyType, buildId);
  }

  private static withBuildNumber(policy: HostPolicy, buildId: number | null, builds: readonly RanBuild[]): HostPolicy {
    const number: string | null = buildId === null ? null : builds.find(t => t.id === buildId)?.build.number ?? null;
    return number === null ? policy : new HostPolicy(policy.name, policy.state, policy.isBlocking, policy.url, number);
  }

  private static mergeTypesOf(evaluations: readonly JsonReader[]): readonly string[] {
    const limits: readonly (readonly string[])[] = evaluations.map(t => t.readObject(Resources.configurationField))
      .filter(t => t.readObject(Resources.typeField).readString(Resources.idField) === Resources.mergeStrategyPolicyType)
      .map(t => AzureReads.allowedBy(t.readObject(Resources.settingsField)));
    return Resources.mergeTypes.filter(type => limits.every(t => t.includes(type)));
  }

  private static allowedBy(settings: JsonReader): readonly string[] {
    if (Resources.mergeTypeSettings.some(t => settings.hasField(t.setting)))
      return Resources.mergeTypeSettings.filter(t => settings.hasField(t.setting) && settings.readBoolean(t.setting)).map(t => t.type);
    const isSquash: boolean = settings.hasField(Resources.useSquashMergeField) && settings.readBoolean(Resources.useSquashMergeField);
    return [isSquash ? Resources.legacySquashMergeType : Resources.legacyMergeType];
  }

  private static autoCompleteMergeTypeOf(pull: JsonReader): string | null {
    if (!pull.hasField(Resources.autoCompleteSetByField) || !pull.hasField(Resources.completionOptionsField))
      return null;
    const options: JsonReader = pull.readObject(Resources.completionOptionsField);
    return options.hasField(Resources.mergeStrategyField) ? options.readNonBlankString(Resources.mergeStrategyField) : null;
  }

  private static buildOf(build: JsonReader): RanBuild {
    const status: string = build.readString(Resources.statusField);
    const state: CheckState = status === Resources.completedStatus ? Resources.buildResults.get(build.readString(Resources.resultField)) ?? CheckState.Failed
      : Resources.runningBuildStatuses.includes(status) ? CheckState.Running : CheckState.Queued;
    const isDone: boolean = status === Resources.completedStatus;
    const web: string = build.readObject(Resources.linksField).readObject(Resources.webField).readString(Resources.hrefField);
    return new RanBuild(new HostBuild(build.readObject(Resources.definitionField).readString(Resources.nameField), state, web,
      build.hasField(Resources.startTimeField) ? Date.parse(build.readString(Resources.startTimeField)) : null,
      isDone ? Date.parse(build.readString(Resources.finishTimeField)) : null,
      build.hasField(Resources.buildNumberField) ? build.readNonBlankString(Resources.buildNumberField) : null),
    build.hasField(Resources.idField) ? build.readInteger(Resources.idField) : null);
  }

  private static closedPolicyOf(policy: HostPolicy): HostPolicy {
    return policy.state === PolicyState.Queued || policy.state === PolicyState.Running
      ? new HostPolicy(policy.name, PolicyState.NotApplicable, policy.isBlocking, policy.url, policy.buildNumber) : policy;
  }

  private static checkOfBuild(build: HostBuild, item: HostItem): HostCheck {
    return new HostCheck(build.name, item.closedAt !== null && build.state === CheckState.Queued ? CheckState.Neutral : build.state, build.url);
  }

  private static checkOfPolicy(policy: HostPolicy): HostCheck {
    return new HostCheck(policy.name, Resources.policyChecks[policy.state], policy.url);
  }

  private static votesOf(pull: JsonReader): readonly number[] {
    return AzureApi.read(() => pull.readObjectArray(Resources.reviewersField).filter(t => !AzureReads.isGroup(t)).map(t => t.readInteger(Resources.voteField)));
  }

  private static isGroup(reviewer: JsonReader): boolean {
    return reviewer.hasField(Resources.isContainerField) && reviewer.readBoolean(Resources.isContainerField);
  }

  private static decisionOf(votes: readonly number[]): ReviewDecision {
    return votes.some(t => t < 0) ? ReviewDecision.ChangesRequested : votes.some(t => t > 0) ? ReviewDecision.Approved : ReviewDecision.Waiting;
  }

  private static branchOf(ref: string): string {
    return ref.startsWith(Resources.headsPrefix) ? ref.slice(Resources.headsPrefix.length) : ref;
  }
}
