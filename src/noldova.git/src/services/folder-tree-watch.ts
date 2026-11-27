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

export class FolderTreeWatch {
  private readonly worktree: string;
  private readonly top: string;
  private readonly ignored: IgnoredPaths;
  private readonly onChange: (name: string | null) => void;
  private readonly onFailed: (error: unknown) => void;
  private readonly watchers: Map<string, FSWatcher> = new Map();
  private readonly skipped: Set<string> = new Set();
  private readonly stop: AbortController = new AbortController();
  private walks: Promise<void> = Promise.resolve();

  public constructor(worktree: string, top: string, ignored: IgnoredPaths, onChange: (name: string | null) => void, onFailed: (error: unknown) => void) {
    this.worktree = worktree;
    this.top = top;
    this.ignored = ignored;
    this.onChange = onChange;
    this.onFailed = onFailed;
  }

  public async startAsync(): Promise<void> {
    try {
      await this.serially(() => this.addTreeAsync(""));
    } catch (error) {
      this.close();
      throw error;
    }
  }

  public recheck(): void {
    if (!this.stop.signal.aborted)
      this.follow(this.serially(() => this.recheckAsync()));
  }

  public close(): void {
    this.stop.abort();
    for (const watcher of this.watchers.values())
      watcher.close();
    this.watchers.clear();
    this.skipped.clear();
  }

  private async addTreeAsync(start: string): Promise<void> {
    let level = [start];
    while (level.length > 0) {
      if (this.watchers.size + level.length > Resources.treeFoldersLimit)
        throw new RangeError(Resources.formatTreeTooLarge(this.worktree, Resources.treeFoldersLimit));
      for (const folder of level)
        await this.addAsync(folder);
      const children = (await Promise.all(level.map(t => this.childrenAsync(t)))).flat();
      const ignored = await this.ignored.ignoredFoldersAsync(this.top, children, this.stop.signal);
      for (const folder of children.filter(t => ignored.has(t)))
        this.skipped.add(folder);
      level = children.filter(t => !ignored.has(t) && !this.watchers.has(t));
    }
  }

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

  private async addAsync(folder: string): Promise<void> {
    this.stop.signal.throwIfAborted();
    this.skipped.delete(folder);
    let watcher: FSWatcher;
    try {
      watcher = watch(path.join(this.worktree, folder), { persistent: false }, (event, name) => this.note(folder, watcher, event, name));
    } catch (error) {
      if (FolderTreeWatch.isGone(error) || !await this.isThereAsync(folder))
        return;
      throw error;
    }
    watcher.on("error", (error: Error) => this.follow(this.loseAsync(folder, watcher, error)));
    this.watchers.set(folder, watcher);
  }

  private note(folder: string, watcher: FSWatcher, event: string, name: string | null): void {
    if (this.stop.signal.aborted)
      return;
    if (name !== null && path.isAbsolute(name)) {
      if (this.watchers.get(folder) === watcher) {
        this.forget(folder);
        this.follow(this.serially(() => this.settleAsync(folder)));
      }
      return;
    }
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

  private async settleAsync(changed: string): Promise<void> {
    const isFolder = await stat(path.join(this.worktree, changed)).then(t => t.isDirectory(), (error: unknown) => {
      if (FolderTreeWatch.isGone(error))
        return false;
      throw error;
    });
    if (!isFolder) {
      this.forget(changed);
      return;
    }
    if (this.watchers.has(changed))
      return;
    if (changed !== "" && (await this.ignored.ignoredFoldersAsync(this.top, [changed], this.stop.signal)).has(changed))
      this.skipped.add(changed);
    else
      await this.addTreeAsync(changed);
  }

  private async recheckAsync(): Promise<void> {
    const skipped = [...this.skipped];
    if (skipped.length === 0)
      return;
    const ignored = await this.ignored.ignoredFoldersAsync(this.top, skipped, this.stop.signal);
    for (const folder of skipped.filter(t => !ignored.has(t)))
      await this.addTreeAsync(folder);
  }

  private async rewalkAsync(): Promise<void> {
    this.ignored.forget();
    for (const watcher of this.watchers.values())
      watcher.close();
    this.watchers.clear();
    this.skipped.clear();
    await this.addTreeAsync("");
  }

  private async loseAsync(folder: string, watcher: FSWatcher, error: Error): Promise<void> {
    watcher.close();
    if (this.watchers.get(folder) === watcher)
      this.watchers.delete(folder);
    if (await this.isThereAsync(folder))
      throw error;
    this.forget(folder);
  }

  private async isThereAsync(folder: string): Promise<boolean> {
    return await stat(path.join(this.worktree, folder)).then(() => true, () => false);
  }

  private forget(gone: string): void {
    for (const [folder, watcher] of this.watchers)
      if (FolderTreeWatch.isIn(folder, gone)) {
        watcher.close();
        this.watchers.delete(folder);
      }
    for (const folder of [...this.skipped].filter(t => FolderTreeWatch.isIn(t, gone)))
      this.skipped.delete(folder);
  }

  private serially(walk: () => Promise<void>): Promise<void> {
    const run = this.walks.then(walk);
    this.walks = run.catch(() => undefined);
    return run;
  }

  private follow(work: Promise<void>): void {
    work.catch((error: unknown) => {
      if (this.stop.signal.aborted)
        return;
      this.close();
      this.onFailed(error);
    });
  }

  private static isIn(folder: string, outer: string): boolean {
    return outer === "" || folder === outer || folder.startsWith(`${outer}/`);
  }

  private static join(folder: string, name: string): string {
    return folder === "" ? name : `${folder}/${name}`;
  }

  private static isGone(error: unknown): boolean {
    return error instanceof Error && "code" in error && (error.code === "ENOENT" || error.code === "ENOTDIR");
  }
}
