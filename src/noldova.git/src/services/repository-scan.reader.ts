/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { Dirent } from "node:fs";
import { readdir } from "node:fs/promises";
import path from "node:path";

import { GitRepositoryScan } from "@noldova/git.protocol";

import { NotARepositoryException } from "../exceptions/not-a-repository.exception.ts";
import { Resources } from "../resources.ts";
import { FilePresence } from "./file-presence.ts";
import type { RepositoryReader } from "./repository.reader.ts";

export class RepositoryScanReader {
  private readonly repositories: RepositoryReader;

  public constructor(repositories: RepositoryReader) {
    this.repositories = repositories;
  }

  public async readAsync(folder: string, signal: AbortSignal): Promise<GitRepositoryScan> {
    try {
      await this.repositories.readAsync(folder);
      return new GitRepositoryScan(true, []);
    } catch (error) {
      if (!(error instanceof NotARepositoryException))
        throw error;
    }
    const found: string[] = [];
    await RepositoryScanReader.walkAsync(folder, await RepositoryScanReader.readFolderAsync(folder), Resources.scanDepth, found, signal);
    return new GitRepositoryScan(false, found.sort());
  }

  private static async walkAsync(folder: string, entries: readonly Dirent[], depth: number, found: string[], signal: AbortSignal): Promise<void> {
    for (const entry of entries) {
      signal.throwIfAborted();
      if (found.length === Resources.scanRepositoriesLimit)
        return;
      if (!entry.isDirectory() || Resources.scanSkippedFolders.has(entry.name))
        continue;
      const child = path.join(folder, entry.name);
      const inside = await RepositoryScanReader.readFolderAsync(child);
      if (inside.some(t => t.name === Resources.gitEntry))
        found.push(child);
      if (depth > 1)
        await RepositoryScanReader.walkAsync(child, inside, depth - 1, found, signal);
    }
  }

  private static async readFolderAsync(folder: string): Promise<readonly Dirent[]> {
    try {
      return await readdir(folder, { withFileTypes: true });
    } catch (error) {
      if (FilePresence.isGone(error) || FilePresence.isDenied(error))
        return [];
      throw error;
    }
  }
}
