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

import { ScanEnd } from "@noldova/git.protocol";

import { Resources } from "../resources.ts";
import { FilePresence } from "./file-presence.ts";

export class RepositoryScanWalk {
  public readonly found: string[] = [];
  private readonly signal: AbortSignal;
  private folders: number = 0;

  public constructor(signal: AbortSignal) {
    this.signal = signal;
  }

  public static async readFolderAsync(folder: string): Promise<readonly Dirent[]> {
    const entries = await readdir(folder, { withFileTypes: true });
    return entries.toSorted((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
  }

  public async walkAsync(folder: string, entries: readonly Dirent[], depth: number): Promise<ScanEnd> {
    for (const entry of entries) {
      this.signal.throwIfAborted();
      if (!entry.isDirectory() || Resources.scanSkippedFolders.has(entry.name))
        continue;
      if (this.found.length === Resources.scanRepositoriesLimit)
        return ScanEnd.RepositoryLimit;
      if (this.folders === Resources.scanFoldersLimit)
        return ScanEnd.FolderLimit;
      this.folders++;
      const child = path.join(folder, entry.name);
      const inside = await RepositoryScanWalk.readSkippingAsync(child);
      if (inside.some(t => t.name === Resources.gitEntry))
        this.found.push(child);
      const end = depth > 1 ? await this.walkAsync(child, inside, depth - 1) : ScanEnd.Complete;
      if (end !== ScanEnd.Complete)
        return end;
    }
    return ScanEnd.Complete;
  }

  private static async readSkippingAsync(folder: string): Promise<readonly Dirent[]> {
    try {
      return await RepositoryScanWalk.readFolderAsync(folder);
    } catch (error) {
      if (FilePresence.isGone(error) || FilePresence.isDenied(error))
        return [];
      throw error;
    }
  }
}
