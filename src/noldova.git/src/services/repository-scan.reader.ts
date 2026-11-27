/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { Dirent } from "node:fs";

import { GitRepositoryScan, ScanEnd } from "@noldova/git.protocol";

import { FolderUnreadableException } from "../exceptions/folder-unreadable.exception.ts";
import { NotARepositoryException } from "../exceptions/not-a-repository.exception.ts";
import { Resources } from "../resources.ts";
import { FilePresence } from "./file-presence.ts";
import type { RepositoryReader } from "./repository.reader.ts";
import { RepositoryScanWalk } from "./repository-scan-walk.ts";

export class RepositoryScanReader {
  private readonly repositories: RepositoryReader;

  public constructor(repositories: RepositoryReader) {
    this.repositories = repositories;
  }

  public async readAsync(folder: string, signal: AbortSignal): Promise<GitRepositoryScan> {
    try {
      await this.repositories.readAsync(folder);
      return new GitRepositoryScan(ScanEnd.Repository, []);
    } catch (error) {
      if (error instanceof FolderUnreadableException)
        return new GitRepositoryScan(ScanEnd.Unreadable, []);
      if (!(error instanceof NotARepositoryException))
        throw error;
    }
    let entries: readonly Dirent[];
    try {
      entries = await RepositoryScanWalk.readFolderAsync(folder);
    } catch (error) {
      if (FilePresence.isGone(error) || FilePresence.isDenied(error))
        return new GitRepositoryScan(ScanEnd.Unreadable, []);
      throw error;
    }
    const walk = new RepositoryScanWalk(signal);
    const end = await walk.walkAsync(folder, entries, Resources.scanDepth);
    return new GitRepositoryScan(end, walk.found.toSorted());
  }
}
