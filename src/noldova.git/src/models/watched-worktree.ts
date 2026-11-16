/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { FSWatcher } from "node:fs";

import { WatchStart } from "../enums/watch-start.ts";
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
  public isForced: boolean = false;
  public isPolledAlways: boolean = false;
  public running: Promise<void> = Promise.resolve();
  public started: Promise<WatchStart> = Promise.resolve(WatchStart.Stopped);

  public constructor(key: string, worktree: string, folders: RepositoryFolders) {
    this.key = key;
    this.worktree = worktree;
    this.folders = folders;
  }
}
