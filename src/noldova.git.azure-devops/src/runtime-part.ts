/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { JsonException, JsonReader } from "@noldova/context.json";
import { Failure, FailureCode, ShellClients } from "@noldova/desktop.protocol";
import { type EventChannel, type IRuntimePart, type IRuntimePartContext, MethodFailureException, type RequestContext } from "@noldova/desktop.runtime";
import { AzureDevOpsNames } from "@noldova/git.azure-devops.protocol";
import { AccountPick, AccountQuery, AuthorQuery, BranchQuery, CommitQuery, HostAvatar, HostingProtocolException, HostPullRequestThreads, HostReference,
  type HostSignIn, PersonQuery, RepositoryAccount, RepositoryQuery, WorkItemQuery, WorkItemsQuery, WorkItemUpdate } from "@noldova/git.hosting.protocol";

import { BranchLink } from "./models/branch-link.ts";
import { PeopleQuery } from "./models/people-query.ts";
import { PullRequestCompletion } from "./models/pull-request-completion.ts";
import { PullRequestAbandonment } from "./models/pull-request-abandonment.ts";
import { PullRequestVote } from "./models/pull-request-vote.ts";
import { ReviewerAddition } from "./models/reviewer-addition.ts";
import { ThreadChange } from "./models/thread-change.ts";
import { ThreadReply } from "./models/thread-reply.ts";
import { TokenSignIn } from "./models/token-sign-in.ts";
import { Resources } from "./resources.ts";
import { AzureAccounts } from "./services/azure-accounts.ts";
import { AzureApi } from "./services/azure-api.ts";
import { AzureAvatars } from "./services/azure-avatars.ts";
import { AzureReads } from "./services/azure-reads.ts";
import type { AzureSignIn } from "./services/azure-sign-in.ts";
import { AzureWrites } from "./services/azure-writes.ts";
import { EntraFlow } from "./services/entra-flow.ts";
import type { SignInMethod } from "./types/sign-in-method.ts";

export class RuntimePart implements IRuntimePart {
  private static readonly firstAccount: number = 1;

  private context: IRuntimePartContext | null = null;
  private accounts: AzureAccounts | null = null;

  public get isActive(): boolean {
    return this.context !== null;
  }

  public async activateAsync(context: IRuntimePartContext): Promise<void> {
    const changed: EventChannel = context.declareEvent(AzureDevOpsNames.signInChangedEvent);
    const accountsChanged: EventChannel = context.declareEvent(AzureDevOpsNames.accountsChangedEvent);
    const fetcher = (url: string, init: RequestInit): Promise<Response> => fetch(url, init);
    const api = new AzureApi(fetcher);
    const accounts: AzureAccounts = new AzureAccounts(api, new EntraFlow(fetcher), context.secrets, context.appWindows, context.log, (id, t) => {
      if (id === RuntimePart.firstAccount)
        changed.publish(t.toJson());
      accountsChanged.publish(accounts.list.toJson());
    });
    const reads = new AzureReads(api, accounts, context.log);
    const writes = new AzureWrites(api, accounts, reads);
    const avatars = new AzureAvatars(api, accounts, context.log);
    const signInOf = (request: RequestContext): AzureSignIn => accounts.signInOf(RuntimePart.accountOf(request));
    const methods: ReadonlyMap<string, SignInMethod> = new Map<string, SignInMethod>([
      [AzureDevOpsNames.readSignInMethod, request => signInOf(request).current],
      [AzureDevOpsNames.startSignInMethod, request => RuntimePart.startOn(signInOf(RuntimePart.fromWindow(request)), request)],
      [AzureDevOpsNames.cancelSignInMethod, request => signInOf(request).cancelSignIn()],
      [AzureDevOpsNames.signInWithTokenMethod, request => RuntimePart.signInWithTokenOn(signInOf(RuntimePart.fromWindow(request)), request)],
      [AzureDevOpsNames.signOutMethod, request => accounts.signOutAsync(RuntimePart.accountOf(request))]
    ]);
    for (const [name, run] of methods)
      context.registerMethod(name, { handleAsync: async request => (await run(request)).toJson() });
    context.registerMethod(AzureDevOpsNames.readAccountsMethod, { handleAsync: () => Promise.resolve(accounts.list.toJson()) });
    context.registerMethod(AzureDevOpsNames.addAccountMethod, {
      handleAsync: async request => {
        const isToken: boolean = RuntimePart.hasToken(RuntimePart.fromWindow(request));
        return (await accounts.addAsync(t => isToken ? RuntimePart.signInWithTokenOn(t, request) : RuntimePart.startOn(t, request))).toJson();
      }
    });
    context.registerMethod(AzureDevOpsNames.readRepositoryAccountMethod, {
      handleAsync: request => {
        const query: RepositoryQuery = RuntimePart.read(request, RepositoryQuery.fromJson);
        return Promise.resolve(new RepositoryAccount(accounts.accountFor(query.host, query.path)).toJson());
      }
    });
    context.registerMethod(AzureDevOpsNames.pickAccountMethod, {
      handleAsync: request => Promise.resolve(new RepositoryAccount(accounts.pick(RuntimePart.read(request, AccountPick.fromJson))).toJson())
    });
    context.registerMethod(AzureDevOpsNames.readReferenceMethod, {
      handleAsync: async request => (await reads.readReferenceAsync(RuntimePart.read(request, HostReference.fromJson), request.signal))?.toJson() ?? null
    });
    context.registerMethod(AzureDevOpsNames.readPullRequestMethod, {
      handleAsync: async request => (await reads.readPullRequestAsync(RuntimePart.read(request, HostReference.fromJson), request.signal))?.toJson() ?? null
    });
    context.registerMethod(AzureDevOpsNames.readBranchPullRequestMethod, {
      handleAsync: async request => (await reads.readBranchPullRequestAsync(RuntimePart.read(request, BranchQuery.fromJson), request.signal)).toJson()
    });
    context.registerMethod(AzureDevOpsNames.readWorkItemMethod, {
      handleAsync: async request => (await reads.readWorkItemAsync(RuntimePart.read(request, WorkItemQuery.fromJson), request.signal))?.toJson() ?? null
    });
    context.registerMethod(AzureDevOpsNames.readWorkItemsMethod, {
      handleAsync: async request => (await reads.readWorkItemsAsync(RuntimePart.read(request, WorkItemsQuery.fromJson), request.signal)).toJson()
    });
    context.registerMethod(AzureDevOpsNames.updateWorkItemMethod, {
      handleAsync: async request => (await writes.updateWorkItemAsync(RuntimePart.read(RuntimePart.fromWindow(request), WorkItemUpdate.fromJson), request.signal))
        .toJson()
    });
    context.registerMethod(AzureDevOpsNames.readAuthorAvatarMethod, {
      handleAsync: async request => new HostAvatar(await avatars.readAuthorAvatarAsync(RuntimePart.read(request, AuthorQuery.fromJson), request.signal)).toJson()
    });
    context.registerMethod(AzureDevOpsNames.readPersonAvatarMethod, {
      handleAsync: async request => new HostAvatar(await avatars.readPersonAvatarAsync(RuntimePart.read(request, PersonQuery.fromJson), request.signal)).toJson()
    });
    context.registerMethod(AzureDevOpsNames.readPullRequestsMethod, {
      handleAsync: async request => (await reads.readPullRequestsAsync(RuntimePart.read(request, RepositoryQuery.fromJson), request.signal)).toJson()
    });
    context.registerMethod(AzureDevOpsNames.readPullRequestHeadsMethod, {
      handleAsync: async request => (await reads.readPullRequestHeadsAsync(RuntimePart.read(request, RepositoryQuery.fromJson), request.signal)).toJson()
    });
    context.registerMethod(AzureDevOpsNames.readReviewRequestsMethod, {
      handleAsync: async request => (await reads.readReviewRequestsAsync(RuntimePart.read(request, RepositoryQuery.fromJson), request.signal)).toJson()
    });
    context.registerMethod(AzureDevOpsNames.readCommitCommentsMethod, {
      handleAsync: async request => (await reads.readCommitCommentsAsync(RuntimePart.read(request, CommitQuery.fromJson), request.signal)).toJson()
    });
    context.registerMethod(AzureDevOpsNames.readPullRequestThreadsMethod, {
      handleAsync: async request => new HostPullRequestThreads(await reads.readPullRequestThreadsAsync(RuntimePart.read(request, HostReference.fromJson),
        request.signal), false).toJson()
    });
    context.registerMethod(AzureDevOpsNames.readPullRequestCommitsMethod, {
      handleAsync: async request => (await reads.readPullRequestCommitsAsync(RuntimePart.read(request, HostReference.fromJson), request.signal)).toJson()
    });
    context.registerMethod(AzureDevOpsNames.readPullRequestUpdatesMethod, {
      handleAsync: async request => (await reads.readPullRequestUpdatesAsync(RuntimePart.read(request, HostReference.fromJson), request.signal)).toJson()
    });
    context.registerMethod(AzureDevOpsNames.readPullRequestChangesMethod, {
      handleAsync: async request => (await reads.readPullRequestChangesAsync(RuntimePart.read(request, HostReference.fromJson), request.signal)).toJson()
    });
    context.registerMethod(AzureDevOpsNames.readPullRequestConflictsMethod, {
      handleAsync: async request => (await reads.readPullRequestConflictsAsync(RuntimePart.read(request, HostReference.fromJson), request.signal)).toJson()
    });
    context.registerMethod(AzureDevOpsNames.linkBranchMethod, {
      handleAsync: async request => {
        await writes.linkBranchAsync(RuntimePart.writeOf(RuntimePart.fromWindow(request), BranchLink.fromJson, Resources.linkExpectedMessage), request.signal);
        return null;
      }
    });
    context.registerMethod(AzureDevOpsNames.replyToThreadMethod, {
      handleAsync: async request => (await writes.replyToThreadAsync(RuntimePart.writeOf(RuntimePart.fromWindow(request), ThreadReply.fromJson,
        Resources.replyExpectedMessage), request.signal)).toJson()
    });
    context.registerMethod(AzureDevOpsNames.changeThreadMethod, {
      handleAsync: async request => {
        await writes.changeThreadAsync(RuntimePart.writeOf(RuntimePart.fromWindow(request), ThreadChange.fromJson, Resources.threadChangeExpectedMessage),
          request.signal);
        return null;
      }
    });
    context.registerMethod(AzureDevOpsNames.voteMethod, {
      handleAsync: async request => (await writes.voteAsync(RuntimePart.writeOf(RuntimePart.fromWindow(request), PullRequestVote.fromJson, Resources.voteExpectedMessage),
        request.signal)).toJson()
    });
    context.registerMethod(AzureDevOpsNames.readMergeTypesMethod, {
      handleAsync: request => reads.readMergeTypesAsync(RuntimePart.read(request, HostReference.fromJson), request.signal)
    });
    context.registerMethod(AzureDevOpsNames.completePullRequestMethod, {
      handleAsync: async request => {
        await writes.completePullRequestAsync(RuntimePart.writeOf(RuntimePart.fromWindow(request), PullRequestCompletion.fromJson,
          Resources.completionExpectedMessage), request.signal);
        return null;
      }
    });
    context.registerMethod(AzureDevOpsNames.setAutoCompleteMethod, {
      handleAsync: async request => {
        await writes.setAutoCompleteAsync(RuntimePart.writeOf(RuntimePart.fromWindow(request), PullRequestCompletion.fromJson,
          Resources.completionExpectedMessage), request.signal);
        return null;
      }
    });
    context.registerMethod(AzureDevOpsNames.cancelAutoCompleteMethod, {
      handleAsync: async request => {
        await writes.cancelAutoCompleteAsync(RuntimePart.writeOf(RuntimePart.fromWindow(request), RuntimePart.ownReferenceOf, Resources.referenceExpectedMessage),
          request.signal);
        return null;
      }
    });
    context.registerMethod(AzureDevOpsNames.abandonPullRequestMethod, {
      handleAsync: async request => {
        await writes.abandonPullRequestAsync(RuntimePart.writeOf(RuntimePart.fromWindow(request), PullRequestAbandonment.fromJson,
          Resources.abandonmentExpectedMessage), request.signal);
        return null;
      }
    });
    context.registerMethod(AzureDevOpsNames.searchPeopleMethod, {
      handleAsync: async request => (await reads.searchPeopleAsync(RuntimePart.writeOf(RuntimePart.fromWindow(request), PeopleQuery.fromJson,
        Resources.peopleQueryExpectedMessage), request.signal)).map(t => t.toJson())
    });
    context.registerMethod(AzureDevOpsNames.readCommitPullRequestMethod, {
      handleAsync: async request => (await reads.readCommitPullRequestAsync(RuntimePart.read(request, CommitQuery.fromJson), request.signal)).toJson()
    });
    context.registerMethod(AzureDevOpsNames.addReviewerMethod, {
      handleAsync: async request => (await writes.addReviewerAsync(RuntimePart.writeOf(RuntimePart.fromWindow(request), ReviewerAddition.fromJson,
        Resources.reviewerExpectedMessage), request.signal)).toJson()
    });
    this.context = context;
    this.accounts = accounts;
    await accounts.restoreAsync();
  }

  public async deactivateAsync(): Promise<void> {
    this.accounts?.dispose();
    this.accounts = null;
    this.context = null;
  }

  private static fromWindow(request: RequestContext): RequestContext {
    if (request.window === null || request.client !== ShellClients.mainProcess)
      throw AzureApi.failure(FailureCode.Unauthorized, Resources.notFromWindowMessage);
    return request;
  }

  private static startOn(signIn: AzureSignIn, request: RequestContext): Promise<HostSignIn> {
    return signIn.startSignInAsync(RuntimePart.organizationOf(request));
  }

  private static signInWithTokenOn(signIn: AzureSignIn, request: RequestContext): Promise<HostSignIn> {
    const token: TokenSignIn = RuntimePart.tokenOf(request);
    return signIn.signInWithTokenAsync(token.token, token.organization, request.signal);
  }

  private static hasToken(request: RequestContext): boolean {
    return RuntimePart.read(request, t => JsonReader.fromValue(t)).hasField(Resources.tokenField);
  }

  private static accountOf(request: RequestContext): number {
    if (request.payload === null)
      return RuntimePart.firstAccount;
    const reader: JsonReader = RuntimePart.read(request, t => JsonReader.fromValue(t));
    return reader.hasField(Resources.accountField)
      ? RuntimePart.read(request, () => new AccountQuery(reader.readInteger(Resources.accountField), reader).account)
      : RuntimePart.firstAccount;
  }

  private static tokenOf(request: RequestContext): TokenSignIn {
    let token: TokenSignIn;
    try {
      const reader: JsonReader = JsonReader.fromValue(request.payload);
      token = new TokenSignIn(reader.readNonBlankString(Resources.tokenField), reader.readString(Resources.organizationField));
    }
    catch {
      throw AzureApi.failure(FailureCode.InvalidParams, Resources.tokenExpectedMessage);
    }
    if (!Resources.organizationPattern.test(token.organization))
      throw AzureApi.failure(FailureCode.InvalidParams, Resources.tokenExpectedMessage);
    return token;
  }

  private static organizationOf(request: RequestContext): string {
    let organization: string;
    try {
      organization = JsonReader.fromValue(request.payload).readString(Resources.organizationField);
    }
    catch {
      throw AzureApi.failure(FailureCode.InvalidParams, Resources.organizationExpectedMessage);
    }
    if (!Resources.organizationPattern.test(organization))
      throw AzureApi.failure(FailureCode.InvalidParams, Resources.organizationExpectedMessage);
    return organization;
  }

  private static ownReferenceOf(value: unknown): HostReference | null {
    const reference: HostReference = HostReference.fromJson(value);
    return Resources.isOwnReference(reference) ? reference : null;
  }

  private static writeOf<T>(request: RequestContext, read: (value: unknown) => T | null, expected: string): T {
    let write: T | null;
    try {
      write = read(request.payload);
    }
    catch {
      throw AzureApi.failure(FailureCode.InvalidParams, expected);
    }
    if (write === null)
      throw AzureApi.failure(FailureCode.InvalidParams, expected);
    return write;
  }

  private static read<T>(request: RequestContext, read: (value: unknown) => T): T {
    try {
      return read(request.payload);
    }
    catch (error) {
      if (!(error instanceof JsonException || error instanceof HostingProtocolException))
        throw error;
      throw new MethodFailureException(new Failure(FailureCode.InvalidParams, String(error)));
    }
  }
}
