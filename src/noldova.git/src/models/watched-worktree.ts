/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { FSWatcher } from "node:fs";

import { WatchStart } from "../enums/watch-start.ts";
import type { FolderTreeWatch } from "../services/folder-tree-watch.ts";
import type { RepositoryFolders } from "./repository-folders.ts";

export class WatchedWorktree {
  public readonly key: string;
  public readonly worktree: string;
  public readonly folders: RepositoryFolders;
  public readonly watchers: FSWatcher[] = [];
  public readonly stop: AbortController = new AbortController();
  public poll: AbortController | null = null;
  public fingerprint: string | null = null;
  public isScheduled: boolean = false;
  public writing: number = 0;
  public generation: number = 0;
  public isPolledAlways: boolean = false;
  /** Whether a watch of the whole worktree reports its files' changes, so a shown worktree is checked only now and then. */
  public isTreeWatched: boolean = false;
  /** The watch of each folder of a shown worktree, on a system whose file watch covers one folder. */
  public folderTree: FolderTreeWatch | null = null;
  /** The worktree's changed paths that wait for its files to go quiet before the module checks whether git ignores them all. */
  public readonly changed: Set<string> = new Set();
  public treeQuiet: NodeJS.Timeout | null = null;
  public treeLongest: NodeJS.Timeout | null = null;
  public running: Promise<void> = Promise.resolve();
  public started: Promise<WatchStart> = Promise.resolve(WatchStart.Stopped);

  public constructor(key: string, worktree: string, folders: RepositoryFolders) {
    this.key = key;
    this.worktree = worktree;
    this.folders = folders;
  }
}
