/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ServiceAccessException } from "@noldova/desktop.runtime";
import type { GitRemote, GitRepositories } from "@noldova/git.protocol";

import { GitHubAccounts } from "./github-accounts.ts";

export class GitHubFolderUsers {
  private readonly accounts: Pick<GitHubAccounts, "useUser">;
  private readonly repositories: () => GitRepositories;

  public constructor(accounts: Pick<GitHubAccounts, "useUser">, repositories: () => GitRepositories) {
    this.accounts = accounts;
    this.repositories = repositories;
  }

  public async useAsync(folder: string, remote: string, host: string, path: string, signal: AbortSignal): Promise<void> {
    let repositories: GitRepositories;
    try {
      repositories = this.repositories();
    }
    catch (error) {
      if (!(error instanceof ServiceAccessException))
        throw error;
      return;
    }
    const found: GitRemote | null = await repositories.readRemoteAsync(folder, remote, signal);
    if (found === null || found.host === null || found.path === null || !GitHubAccounts.isSameKey(found.host, found.path, host, path))
      return;
    this.accounts.useUser(found.host, found.path, await repositories.readRemoteUserAsync(folder, remote, signal));
  }
}
