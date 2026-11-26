/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { type FSWatcher, watch } from "node:fs";
import { readdir, stat } from "node:fs/promises";
import path from "node:path";

import { Resources } from "../resources.ts";
import type { IgnoredPaths } from "./ignored-paths.ts";

/**
 * Watches each folder of a worktree that git doesn't ignore, on a system whose file watch covers one folder, not a tree: it walks the tree a level at a
 * time, asking git once a level which of its folders it ignores, so a build's output or a package folder takes no watch, and it adds a folder made later
 * and drops one removed. A changed ignore file walks the tree again, as it can change which folders git ignores.
 */
export class FolderTreeWatch {
  private readonly worktree: string;
  private readonly top: string;
  private readonly ignored: IgnoredPaths;
  private readonly onChange: (name: string | null) => void;
  private readonly onFailed: (error: unknown) => void;
  private readonly watchers: Map<string, FSWatcher> = new Map();
  private readonly stop: AbortController = new AbortController();
  private walks: Promise<void> = Promise.resolve();

  /**
   * @param onChange Takes each changed path, relative to the worktree with `/`, or null when the system names none.
   * @param onFailed Takes the error that ends the watch once it started, after it closed every folder's watch.
   */
  public constructor(worktree: string, top: string, ignored: IgnoredPaths, onChange: (name: string | null) => void, onFailed: (error: unknown) => void) {
    this.worktree = worktree;
    this.top = top;
    this.ignored = ignored;
    this.onChange = onChange;
    this.onFailed = onFailed;
  }

  /** Watches every folder git doesn't ignore; it fails, with nothing watched, when there are more than the module watches in one worktree. */
  public async startAsync(): Promise<void> {
    try {
      await this.serially(() => this.addTreeAsync(""));
    } catch (error) {
      this.close();
      throw error;
    }
  }

  public close(): void {
    this.stop.abort();
    for (const watcher of this.watchers.values())
      watcher.close();
    this.watchers.clear();
  }

  /** Watches a folder and the folders under it that git doesn't ignore, a level at a time, failing once that would pass the limit. */
  private async addTreeAsync(start: string): Promise<void> {
    let level = [start];
    while (level.length > 0) {
      if (this.watchers.size + level.length > Resources.treeFoldersLimit)
        throw new RangeError(Resources.formatTreeTooLarge(this.worktree, Resources.treeFoldersLimit));
      for (const folder of level)
        this.add(folder);
      const children = (await Promise.all(level.map(t => this.childrenAsync(t)))).flat();
      const ignored = await this.ignored.ignoredFoldersAsync(this.top, children, this.stop.signal);
      level = children.filter(t => !ignored.has(t) && !this.watchers.has(t));
    }
  }

  /** A folder's own folders, relative to the worktree, leaving out the git folder; none once the folder is gone. */
  private async childrenAsync(folder: string): Promise<string[]> {
    try {
      const entries = await readdir(path.join(this.worktree, folder), { withFileTypes: true });
      return entries.filter(t => t.isDirectory() && t.name !== Resources.dotGitName).map(t => FolderTreeWatch.join(folder, t.name));
    } catch (error) {
      if (FolderTreeWatch.isGone(error))
        return [];
      throw error;
    }
  }

  /**
   * Watches one folder, unless it is gone by now, as a folder made and removed at once can be; once the watch is closed, a walk still running stops here
   * rather than leave a watch behind.
   */
  private add(folder: string): void {
    this.stop.signal.throwIfAborted();
    let watcher: FSWatcher;
    try {
      watcher = watch(path.join(this.worktree, folder), { persistent: false }, (event, name) => this.note(folder, event, name));
    } catch (error) {
      if (FolderTreeWatch.isGone(error))
        return;
      throw error;
    }
    watcher.on("error", (error: Error) => this.follow(this.loseAsync(folder, watcher, error)));
    this.watchers.set(folder, watcher);
  }

  private note(folder: string, event: string, name: string | null): void {
    if (this.stop.signal.aborted)
      return;
    if (name === null) {
      this.onChange(null);
      return;
    }
    const changed = FolderTreeWatch.join(folder, name);
    this.onChange(changed);
    if (name === Resources.ignoreFileName)
      this.follow(this.serially(() => this.rewalkAsync()));
    else if (event === "rename" && name !== Resources.dotGitName)
      this.follow(this.serially(() => this.settleAsync(changed)));
  }

  /** Watches a folder made or moved in, unless git ignores it, and drops the watches of one removed or moved away. */
  private async settleAsync(changed: string): Promise<void> {
    const isFolder = await stat(path.join(this.worktree, changed)).then(t => t.isDirectory(), (error: unknown) => {
      if (FolderTreeWatch.isGone(error))
        return false;
      throw error;
    });
    if (!isFolder) {
      for (const [folder, watcher] of this.watchers)
        if (folder === changed || folder.startsWith(`${changed}/`)) {
          watcher.close();
          this.watchers.delete(folder);
        }
      return;
    }
    if (!this.watchers.has(changed) && !(await this.ignored.ignoredFoldersAsync(this.top, [changed], this.stop.signal)).has(changed))
      await this.addTreeAsync(changed);
  }

  /** Walks the tree again from its top, as a changed ignore file can ignore a watched folder or stop ignoring one. */
  private async rewalkAsync(): Promise<void> {
    this.ignored.forget();
    for (const watcher of this.watchers.values())
      watcher.close();
    this.watchers.clear();
    await this.addTreeAsync("");
  }

  /** Drops the watch of a folder that went away; any other error ends the whole watch. */
  private async loseAsync(folder: string, watcher: FSWatcher, error: Error): Promise<void> {
    watcher.close();
    if (this.watchers.get(folder) === watcher)
      this.watchers.delete(folder);
    const isThere = await stat(path.join(this.worktree, folder)).then(() => true, () => false);
    if (isThere)
      throw error;
  }

  /**
   * Runs a walk once the walks before it end, so two never add the same folder: an ignore file written can be heard twice, and a second walk starting while
   * the first still runs would watch a folder twice and leave one watch open past the close.
   */
  private serially(walk: () => Promise<void>): Promise<void> {
    const run = this.walks.then(walk);
    this.walks = run.catch(() => undefined);
    return run;
  }

  /** Ends the whole watch when a change it follows fails, unless the watch closed first. */
  private follow(work: Promise<void>): void {
    work.catch((error: unknown) => {
      if (this.stop.signal.aborted)
        return;
      this.close();
      this.onFailed(error);
    });
  }

  private static join(folder: string, name: string): string {
    return folder === "" ? name : `${folder}/${name}`;
  }

  private static isGone(error: unknown): boolean {
    return error instanceof Error && "code" in error && (error.code === "ENOENT" || error.code === "ENOTDIR");
  }
}
