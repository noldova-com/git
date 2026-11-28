/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { type HostSignIn, SignInState } from "@noldova/git.hosting.protocol";
import { GitHubAccessGrant, type GitHubAccessQuery, GitHubAccessRefusal, type IGitHubAccess } from "@noldova/git.github.protocol";

import { Resources } from "../resources.ts";

interface IAccessSignIn {
  readonly current: HostSignIn;
  readonly token: string | null;
  readonly keptUnreadable: boolean;
}

interface IAccessFolders {
  useAsync(folder: string, remote: string, host: string, path: string, signal: AbortSignal): Promise<void>;
}

interface IAccessAccounts {
  readonly first: IAccessSignIn;
  accountForAsync(host: string, path: string, signal: AbortSignal): Promise<number | null>;
  signInOf(id: number): IAccessSignIn;
}

export class GitHubAccess implements IGitHubAccess {
  private readonly accounts: IAccessAccounts;
  private readonly folders: IAccessFolders;

  public constructor(accounts: IAccessAccounts, folders: IAccessFolders) {
    this.accounts = accounts;
    this.folders = folders;
  }

  public accessAsync(signal: AbortSignal): Promise<GitHubAccessGrant | GitHubAccessRefusal> {
    return signal.aborted ? Promise.reject(signal.reason) : Promise.resolve(GitHubAccess.answerOf(this.accounts.first));
  }

  public async accessForAsync(repository: GitHubAccessQuery, signal: AbortSignal): Promise<GitHubAccessGrant | GitHubAccessRefusal> {
    signal.throwIfAborted();
    if (!Object.isNull(repository.folder))
      await this.folders.useAsync(repository.folder, repository.remote ?? Resources.originRemote, repository.host, repository.path, signal);
    const id: number | null = await this.accounts.accountForAsync(repository.host, repository.path, signal);
    return GitHubAccess.answerOf(id === null ? this.accounts.first : this.accounts.signInOf(id));
  }

  private static answerOf(signIn: IAccessSignIn): GitHubAccessGrant | GitHubAccessRefusal {
    const current = signIn.current;
    const token = signIn.token;
    if (current.account !== null && token !== null)
      return new GitHubAccessGrant(token, current.account.login, Resources.host);
    if (current.state === SignInState.Waiting)
      return new GitHubAccessRefusal(Resources.accessWaitingReason);
    return new GitHubAccessRefusal(signIn.keptUnreadable ? Resources.accessUnreadableReason : Resources.accessSignedOutReason);
  }
}
