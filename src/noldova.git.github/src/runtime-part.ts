/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { JsonException } from "@noldova/context.json";
import { Failure, FailureCode, ShellClients } from "@noldova/desktop.protocol";
import { type EventChannel, type IRuntimePart, type IRuntimePartContext, MethodFailureException, type RequestContext } from "@noldova/desktop.runtime";
import { AuthorQuery, BranchQuery, CommitQuery, HostAvatar, HostingProtocolException, HostReference, PullRequestDraft, RepositoryQuery,
  SignInState } from "@noldova/git.hosting.protocol";
import { GitHubNames } from "@noldova/git.github.protocol";
import { GitNames, GitRepositories } from "@noldova/git.protocol";

import { SignInMethod } from "./models/sign-in-method.ts";
import { Resources } from "./resources.ts";
import { GitHubAccess } from "./services/github-access.ts";
import { GitHubApi } from "./services/github-api.ts";
import { GitHubAvatars } from "./services/github-avatars.ts";
import { GitHubDeviceFlow } from "./services/github-device-flow.ts";
import { GitHubReads } from "./services/github-reads.ts";
import { GitHubSignIn } from "./services/github-sign-in.ts";
import { GitHubTools } from "./tools/github-tools.ts";

export class RuntimePart implements IRuntimePart {
  private context: IRuntimePartContext | null = null;
  private signIn: GitHubSignIn | null = null;
  private tools: GitHubTools | null = null;

  public get isActive(): boolean {
    return this.context !== null;
  }

  public async activateAsync(context: IRuntimePartContext): Promise<void> {
    const changed: EventChannel = context.declareEvent(GitHubNames.signInChangedEvent);
    const fetcher = (url: string, init: RequestInit): Promise<Response> => fetch(url, init);
    const api = new GitHubApi(fetcher);
    const avatars = new GitHubAvatars(fetcher, context.log);
    const signIn = new GitHubSignIn(new GitHubDeviceFlow(fetcher, avatars), context.secrets, context.appWindows, context.log, t => {
      if (t.state !== SignInState.SignedIn)
        api.clear();
      changed.publish(t.toJson());
    });
    const reads = new GitHubReads(api, signIn, avatars);
    const methods: readonly SignInMethod[] = [
      new SignInMethod(GitHubNames.readSignInMethod, () => signIn.current),
      new SignInMethod(GitHubNames.startSignInMethod, () => signIn.startAsync()),
      new SignInMethod(GitHubNames.cancelSignInMethod, () => signIn.cancel()),
      new SignInMethod(GitHubNames.signOutMethod, () => signIn.signOutAsync())
    ];
    for (const method of methods)
      context.registerMethod(method.name, { handleAsync: async () => (await method.run()).toJson() });
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
    context.registerMethod(GitHubNames.createPullRequestMethod, {
      handleAsync: async request => (await reads.createPullRequestAsync(RuntimePart.read(RuntimePart.fromWindow(request), PullRequestDraft.fromJson),
        request.signal)).toJson()
    });
    context.publishService(GitHubNames.accessService, new GitHubAccess(signIn));
    const tools = new GitHubTools(reads, signIn, () => context.getService(GitNames.repositoriesService, GitRepositories));
    this.context = context;
    this.signIn = signIn;
    this.tools = tools;
    await signIn.restoreAsync();
    tools.publish(context.tools);
  }

  public async deactivateAsync(): Promise<void> {
    this.tools?.dispose();
    this.tools = null;
    this.signIn?.dispose();
    this.signIn = null;
    this.context = null;
  }

  private static fromWindow(request: RequestContext): RequestContext {
    if (request.window === null || request.client !== ShellClients.mainProcess)
      throw GitHubApi.failure(FailureCode.Unauthorized, Resources.notFromWindowMessage);
    return request;
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
