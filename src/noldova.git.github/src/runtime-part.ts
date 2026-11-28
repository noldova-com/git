/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { JsonException } from "@noldova/context.json";
import { Failure, FailureCode, ShellClients } from "@noldova/desktop.protocol";
import { type EventChannel, type IRuntimePart, type IRuntimePartContext, MethodFailureException, type RequestContext, ServiceAccessException } from "@noldova/desktop.runtime";
import { AccountPick, AccountQuery, AuthorQuery, BranchQuery, CommitQuery, FolderQuery, HostAvatar, HostingProtocolException, HostReference, PullRequestDraft,
  RepositoryAccount, RepositoryQuery } from "@noldova/git.hosting.protocol";
import { GitHubNames } from "@noldova/git.github.protocol";
import { GitNames, type GitRemote, GitRepositories } from "@noldova/git.protocol";

import { SignInMethod } from "./models/sign-in-method.ts";
import { Resources } from "./resources.ts";
import { GitHubAccess } from "./services/github-access.ts";
import { GitHubAccounts } from "./services/github-accounts.ts";
import { GitHubApi } from "./services/github-api.ts";
import { GitHubAvatars } from "./services/github-avatars.ts";
import { GitHubDeviceFlow } from "./services/github-device-flow.ts";
import { GitHubReads } from "./services/github-reads.ts";
import { GitHubTools } from "./tools/github-tools.ts";

export class RuntimePart implements IRuntimePart {
  private static readonly firstAccount: number = 1;

  private context: IRuntimePartContext | null = null;
  private accounts: GitHubAccounts | null = null;
  private tools: GitHubTools | null = null;

  public get isActive(): boolean {
    return !Object.isNull(this.context);
  }

  public async activateAsync(context: IRuntimePartContext): Promise<void> {
    const changed: EventChannel = context.declareEvent(GitHubNames.signInChangedEvent);
    const accountsChanged: EventChannel = context.declareEvent(GitHubNames.accountsChangedEvent);
    const fetcher = (url: string, init: RequestInit): Promise<Response> => fetch(url, init);
    const api = new GitHubApi(fetcher);
    const avatars = new GitHubAvatars(fetcher, context.log);
    const accounts: GitHubAccounts = new GitHubAccounts(new GitHubDeviceFlow(fetcher, avatars), context.secrets, context.appWindows, context.log, api, (id, t) => {
      api.keepOnly(u => accounts.holds(u));
      if (id === RuntimePart.firstAccount)
        changed.publish(t.toJson());
      accountsChanged.publish(accounts.list.toJson());
    });
    const reads = new GitHubReads(api, accounts, avatars);
    const methods: readonly SignInMethod[] = [
      new SignInMethod(GitHubNames.readSignInMethod, t => accounts.signInOf(t).current),
      new SignInMethod(GitHubNames.startSignInMethod, t => accounts.signInOf(t).startAsync()),
      new SignInMethod(GitHubNames.cancelSignInMethod, t => accounts.signInOf(t).cancel()),
      new SignInMethod(GitHubNames.signOutMethod, t => accounts.signOutAsync(t))
    ];
    for (const method of methods) {
      context.registerMethod(method.name, {
        handleAsync: async request => (await method.run(Object.isNull(request.payload) ? RuntimePart.firstAccount : RuntimePart.read(request, AccountQuery.fromJson).account)).toJson()
      });
    }
    context.registerMethod(GitHubNames.readReferenceMethod, {
      handleAsync: async request => (await reads.readShownReferenceAsync(RuntimePart.read(request, HostReference.fromJson), request.signal))?.toJson() ?? null
    });
    context.registerMethod(GitHubNames.readBranchPullRequestMethod, {
      handleAsync: async request => (await reads.readBranchPullRequestAsync(RuntimePart.read(request, BranchQuery.fromJson), request.signal)).toJson()
    });
    context.registerMethod(GitHubNames.readAuthorAvatarMethod, {
      handleAsync: async request => new HostAvatar(await reads.readAuthorAvatarAsync(RuntimePart.read(request, AuthorQuery.fromJson), request.signal)).toJson()
    });
    context.registerMethod(GitHubNames.readPullRequestsMethod, {
      handleAsync: async request => (await reads.readPullRequestsAsync(RuntimePart.read(request, RepositoryQuery.fromJson), request.signal)).toJson()
    });
    context.registerMethod(GitHubNames.readReviewRequestsMethod, {
      handleAsync: async request => (await reads.readReviewRequestsAsync(RuntimePart.read(request, RepositoryQuery.fromJson), request.signal)).toJson()
    });
    context.registerMethod(GitHubNames.readCommitCommentsMethod, {
      handleAsync: async request => (await reads.readCommitCommentsAsync(RuntimePart.read(request, CommitQuery.fromJson), request.signal)).toJson()
    });
    context.registerMethod(GitHubNames.readPullRequestMethod, {
      handleAsync: async request => (await reads.readPullRequestAsync(RuntimePart.read(request, HostReference.fromJson), request.signal))?.toJson() ?? null
    });
    context.registerMethod(GitHubNames.readPullRequestThreadsMethod, {
      handleAsync: async request => (await reads.readPullRequestThreadsAsync(RuntimePart.read(request, HostReference.fromJson), request.signal)).toJson()
    });
    context.registerMethod(GitHubNames.readCommitPullRequestMethod, {
      handleAsync: async request => (await reads.readCommitPullRequestAsync(RuntimePart.read(request, CommitQuery.fromJson), request.signal)).toJson()
    });
    context.registerMethod(GitHubNames.createPullRequestMethod, {
      handleAsync: async request => (await reads.createPullRequestAsync(RuntimePart.read(RuntimePart.fromWindow(request, Resources.notFromWindowMessage),
        PullRequestDraft.fromJson), request.signal)).toJson()
    });
    context.registerMethod(GitHubNames.readAccountsMethod, { handleAsync: () => Promise.resolve(accounts.list.toJson()) });
    context.registerMethod(GitHubNames.addAccountMethod, { handleAsync: async () => (await accounts.addAsync()).toJson() });
    context.registerMethod(GitHubNames.readRepositoryAccountMethod, {
      handleAsync: async request => {
        const query: RepositoryQuery = RuntimePart.read(request, RepositoryQuery.fromJson);
        return (await accounts.repositoryAccountAsync(query.host, query.path, request.signal)).toJson();
      }
    });
    context.registerMethod(GitHubNames.pickAccountMethod, {
      handleAsync: async request => (await accounts.pickAsync(RuntimePart.read(request, AccountPick.fromJson), request.signal)).toJson()
    });
    context.registerMethod(GitHubNames.useFolderMethod, {
      handleAsync: async request => {
        const query: FolderQuery = RuntimePart.read(RuntimePart.fromWindow(request, Resources.folderNotFromWindowMessage), FolderQuery.fromJson);
        const repositories: GitRepositories = RuntimePart.gitOf(context);
        const remote: GitRemote | null = await repositories.readRemoteAsync(query.folder, query.remote, request.signal);
        if (Object.isNull(remote) || Object.isNull(remote.host) || Object.isNull(remote.path))
          return new RepositoryAccount(null).toJson();
        accounts.useUser(remote.host, remote.path, await repositories.readRemoteUserAsync(query.folder, query.remote, request.signal));
        return (await accounts.repositoryAccountAsync(remote.host, remote.path, request.signal)).toJson();
      }
    });
    context.publishService(GitHubNames.accessService, new GitHubAccess(accounts));
    const tools = new GitHubTools(reads, accounts, () => context.getService(GitNames.repositoriesService, GitRepositories));
    this.context = context;
    this.accounts = accounts;
    this.tools = tools;
    await accounts.restoreAsync();
    tools.publish(context.tools);
  }

  public async deactivateAsync(): Promise<void> {
    this.tools?.dispose();
    this.tools = null;
    this.accounts?.dispose();
    this.accounts = null;
    this.context = null;
  }

  private static fromWindow(request: RequestContext, message: string): RequestContext {
    if (Object.isNull(request.window) || request.client !== ShellClients.mainProcess)
      throw GitHubApi.failure(FailureCode.Unauthorized, message);
    return request;
  }

  private static gitOf(context: IRuntimePartContext): GitRepositories {
    try {
      return context.getService(GitNames.repositoriesService, GitRepositories);
    }
    catch (error) {
      if (!(error instanceof ServiceAccessException))
        throw error;
      throw GitHubApi.failure(FailureCode.Unavailable, Resources.gitMissingMessage);
    }
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
