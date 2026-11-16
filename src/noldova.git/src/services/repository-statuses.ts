/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { GitFolderParams, type GitRemote, GitRepositories, type GitStatus } from "@noldova/git.protocol";

import type { RepositoryFolders } from "../models/repository-folders.ts";
import type { KeyQueue } from "./key-queue.ts";
import { MethodFailures } from "./method-failures.ts";
import type { RemoteReader } from "./remote.reader.ts";
import type { RepositoryReader } from "./repository.reader.ts";
import type { StatusReader } from "./status.reader.ts";

export class RepositoryStatuses extends GitRepositories {
  private readonly repositories: RepositoryReader;
  private readonly statuses: StatusReader;
  private readonly remotes: RemoteReader;
  private readonly reads: KeyQueue;

  public constructor(repositories: RepositoryReader, statuses: StatusReader, remotes: RemoteReader, reads: KeyQueue) {
    super();
    this.repositories = repositories;
    this.statuses = statuses;
    this.remotes = remotes;
    this.reads = reads;
  }

  public async readStatusAsync(folder: string, signal: AbortSignal): Promise<GitStatus> {
    try {
      const params = new GitFolderParams(folder);
      const folders: RepositoryFolders = await this.repositories.readAsync(params.folder);
      return await this.reads.runAsync(folders.top, () => this.statuses.readAsync(folders, signal));
    } catch (error) {
      throw MethodFailures.toMethodFailure(error);
    }
  }

  public async readRemoteAsync(folder: string, name: string, signal: AbortSignal): Promise<GitRemote | null> {
    try {
      const params = new GitFolderParams(folder);
      const folders: RepositoryFolders = await this.repositories.readAsync(params.folder);
      return await this.reads.runAsync(folders.top, () => this.remotes.readNamedAsync(folders.top, name, signal));
    } catch (error) {
      throw MethodFailures.toMethodFailure(error);
    }
  }
}
