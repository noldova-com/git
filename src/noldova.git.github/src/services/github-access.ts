/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { SignInState } from "@noldova/git.hosting.protocol";
import { GitHubAccessGrant, GitHubAccessRefusal, type IGitHubAccess } from "@noldova/git.github.protocol";

import { Resources } from "../resources.ts";
import type { GitHubSignIn } from "./github-sign-in.ts";

type AccessSignIn = Pick<GitHubSignIn, "current" | "token" | "keptUnreadable">;

interface IAccessAccounts {
  readonly first: AccessSignIn;
  accountForAsync(host: string, path: string, signal: AbortSignal): Promise<number | null>;
  signInOf(id: number): AccessSignIn;
}

export class GitHubAccess implements IGitHubAccess {
  private readonly accounts: IAccessAccounts;

  public constructor(accounts: IAccessAccounts) {
    this.accounts = accounts;
  }

  public accessAsync(signal: AbortSignal): Promise<GitHubAccessGrant | GitHubAccessRefusal> {
    return signal.aborted ? Promise.reject(signal.reason) : Promise.resolve(GitHubAccess.answerOf(this.accounts.first));
  }

  public async accessForAsync(repository: { readonly host: string; readonly path: string }, signal: AbortSignal): Promise<GitHubAccessGrant | GitHubAccessRefusal> {
    signal.throwIfAborted();
    if (repository.host.toLowerCase() !== Resources.host)
      return new GitHubAccessRefusal(Resources.accessOtherHostReason);
    const id: number | null = await this.accounts.accountForAsync(repository.host, repository.path, signal);
    return GitHubAccess.answerOf(id === null ? this.accounts.first : this.accounts.signInOf(id));
  }

  private static answerOf(signIn: AccessSignIn): GitHubAccessGrant | GitHubAccessRefusal {
    const current = signIn.current;
    const token = signIn.token;
    if (current.account !== null && token !== null)
      return new GitHubAccessGrant(token, current.account.login, Resources.host);
    if (current.state === SignInState.Waiting)
      return new GitHubAccessRefusal(Resources.accessWaitingReason);
    return new GitHubAccessRefusal(signIn.keptUnreadable ? Resources.accessUnreadableReason : Resources.accessSignedOutReason);
  }
}
