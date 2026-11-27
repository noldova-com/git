/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { randomUUID } from "node:crypto";
import { watch } from "node:fs";
import { readdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import timers from "node:timers";

import type { IModuleLog } from "@noldova/desktop.runtime";

import { TreeWatch } from "../enums/tree-watch.ts";
import { WatchStart } from "../enums/watch-start.ts";
import type { RepositoryFolders } from "../models/repository-folders.ts";
import { WatchCookie } from "../models/watch-cookie.ts";
import { WatchedWorktree } from "../models/watched-worktree.ts";
import { Resources } from "../resources.ts";
import { FilePresence } from "./file-presence.ts";
import { FolderTreeWatch } from "./folder-tree-watch.ts";
import { IgnoredPaths } from "./ignored-paths.ts";
import type { ProgramRunner } from "./program-runner.ts";
import { StatusReader } from "./status.reader.ts";

export class ChangeMonitor {
  private readonly statuses: StatusReader;
  private readonly ignored: IgnoredPaths;
  private readonly treeWatch: TreeWatch;
  private readonly log: IModuleLog;
  private readonly onChanged: (key: string, sequence: number) => void;
  private readonly worktrees: Map<string, WatchedWorktree> = new Map();
  private readonly running: Set<Promise<void>> = new Set();
  private readonly cookies: Set<string> = new Set();
  private sequence: number = 0;
  private isDisposed: boolean = false;

  public constructor(runner: ProgramRunner, log: IModuleLog, onChanged: (key: string, sequence: number) => void, treeWatch: TreeWatch) {
    this.statuses = new StatusReader(runner);
    this.ignored = new IgnoredPaths(runner);
    this.treeWatch = treeWatch;
    this.log = log;
    this.onChanged = onChanged;
  }

  public watch(key: string, worktree: string, folders: RepositoryFolders, isReftable: boolean = false): void {
    if (this.isDisposed)
      return;
    this.unwatch(key);
    const watched = new WatchedWorktree(key, worktree, folders);
    this.worktrees.set(key, watched);
    const cookies = [
      this.addWatcher(watched, folders.gitFolder, t => this.acceptsGitFile(watched, t), ""),
      isReftable
        ? this.addWatcher(watched, path.join(folders.commonGitFolder, Resources.reftableFolder), t => t === Resources.reftableListFile, undefined)
        : this.addWatcher(watched, path.join(folders.commonGitFolder, ...Resources.branchRefsFolder), t => !t.endsWith(Resources.lockExtension), Resources.lockExtension)
    ];
    this.addWatcher(watched, folders.commonGitFolder, t => t === Resources.packedRefsFile, undefined);
    if (this.treeWatch === TreeWatch.Whole)
      this.addTreeWatcher(watched);
    watched.started = this.startAsync(watched, cookies.filter(t => t !== undefined));
    this.track(watched.started.then(() => undefined, () => undefined));
  }

  public startedAsync(key: string): Promise<WatchStart> {
    return this.worktrees.get(key)?.started ?? Promise.resolve(WatchStart.Stopped);
  }

  public unwatch(key: string): void {
    const watched = this.worktrees.get(key);
    if (watched === undefined)
      return;
    this.worktrees.delete(key);
    watched.stop.abort();
    ChangeMonitor.endTreeWaits(watched);
    ChangeMonitor.stopFolderTree(watched);
    for (const watcher of watched.watchers)
      watcher.close();
  }

  public setVisible(key: string, isVisible: boolean): void {
    const watched = this.worktrees.get(key);
    if (watched === undefined)
      return;
    if (watched.poll !== null) {
      if (!isVisible) {
        watched.poll.abort();
        watched.poll = null;
        ChangeMonitor.stopFolderTree(watched);
      }
      return;
    }
    if (!isVisible)
      return;
    watched.poll = new AbortController();
    if (this.treeWatch === TreeWatch.Folders)
      this.startFolderTree(watched);
    this.schedule(watched);
    this.track(this.pollAsync(watched, AbortSignal.any([watched.poll.signal, watched.stop.signal]),
      () => watched.isTreeWatched ? Resources.backstopPollMilliseconds : Resources.changePollMilliseconds));
  }

  public notifyWriting(key: string): void {
    const watched = this.worktrees.get(key);
    if (watched === undefined)
      return;
    watched.writing += 1;
    watched.generation += 1;
  }

  public notifyWritten(key: string): void {
    const watched = this.worktrees.get(key);
    if (watched === undefined)
      return;
    watched.writing = Math.max(0, watched.writing - 1);
    watched.generation += 1;
    watched.fingerprint = null;
    this.onChanged(watched.key, ++this.sequence);
  }

  public generationOf(key: string): number {
    return this.worktrees.get(key)?.generation ?? 0;
  }

  public observe(key: string, generation: number, fingerprint: string): void {
    const watched = this.worktrees.get(key);
    if (watched !== undefined && watched.writing === 0 && watched.generation === generation && watched.fingerprint === null)
      watched.fingerprint = fingerprint;
  }

  public async disposeAsync(): Promise<void> {
    this.isDisposed = true;
    for (const key of [...this.worktrees.keys()])
      this.unwatch(key);
    await Promise.all(this.running);
  }

  private addWatcher(watched: WatchedWorktree, folder: string, accepts: (name: string) => boolean, cookieExtension: string | undefined): WatchCookie | undefined {
    const cookie = cookieExtension === undefined ? undefined : new WatchCookie(folder, Resources.formatWatchCookie(randomUUID(), cookieExtension));
    try {
      const watcher = watch(folder, { persistent: false }, (_event, name) => {
        if (cookie !== undefined && name === cookie.name)
          cookie.markSeen();
        else if (name === null || accepts(name))
          this.schedule(watched);
      });
      watcher.on("error", (error: Error) => {
        this.log.write(Resources.formatWatchFailed(folder, String(error)));
        watcher.close();
        this.pollAlways(watched);
      });
      watched.watchers.push(watcher);
      return cookie;
    } catch (error) {
      this.log.write(Resources.formatWatchFailed(folder, String(error)));
      this.pollAlways(watched);
      return undefined;
    }
  }

  private acceptsGitFile(watched: WatchedWorktree, name: string): boolean {
    if (name === Resources.indexFile) {
      this.ignored.forgetIndex(watched.folders.top);
      watched.folderTree?.recheck();
    }
    return Resources.watchedGitFiles.includes(name);
  }

  private addTreeWatcher(watched: WatchedWorktree): void {
    try {
      const watcher = watch(watched.worktree, { persistent: false, recursive: true }, (_event, name) => this.noteTreeChange(watched, name));
      watcher.on("error", (error: Error) => {
        this.log.write(Resources.formatWatchFailed(watched.worktree, String(error)));
        watcher.close();
        watched.isTreeWatched = false;
      });
      watched.watchers.push(watcher);
      watched.isTreeWatched = true;
    } catch (error) {
      this.log.write(Resources.formatWatchFailed(watched.worktree, String(error)));
    }
  }

  private startFolderTree(watched: WatchedWorktree): void {
    const tree: FolderTreeWatch = new FolderTreeWatch(watched.worktree, watched.folders.top, this.ignored, name => this.noteTreeChange(watched, name),
      error => this.loseFolderTree(watched, tree, Resources.formatWatchFailed(watched.worktree, String(error))),
      (folder, error) => this.log.write(Resources.formatWatchRefused(folder, String(error))));
    watched.folderTree = tree;
    this.track(tree.startAsync().then(() => {
      watched.isTreeWatched ||= watched.folderTree === tree;
    }, (error: unknown) => this.loseFolderTree(watched, tree, Resources.formatWatchFailed(watched.worktree, String(error)))));
  }

  private loseFolderTree(watched: WatchedWorktree, tree: FolderTreeWatch, line: string): void {
    if (watched.folderTree !== tree)
      return;
    ChangeMonitor.stopFolderTree(watched);
    this.log.write(line);
  }

  private static stopFolderTree(watched: WatchedWorktree): void {
    watched.folderTree?.close();
    watched.folderTree = null;
    watched.isTreeWatched = false;
  }

  private noteTreeChange(watched: WatchedWorktree, name: string | null): void {
    if (watched.poll === null)
      return;
    if (name === null) {
      this.schedule(watched);
      return;
    }
    watched.changed.add(name);
    if (watched.treeQuiet !== null)
      timers.clearTimeout(watched.treeQuiet);
    const check = (): void => this.checkTree(watched);
    watched.treeQuiet = timers.setTimeout(check, Resources.treeQuietMilliseconds);
    watched.treeLongest ??= timers.setTimeout(check, Resources.treeLongestWaitMilliseconds);
  }

  private checkTree(watched: WatchedWorktree): void {
    ChangeMonitor.endTreeWaits(watched);
    const names = [...watched.changed];
    watched.changed.clear();
    this.track(this.ignored.hasShownAsync(watched.folders.top, names, watched.stop.signal).then(isShown => {
      if (isShown)
        this.schedule(watched);
    }, (error: unknown) => {
      if (watched.stop.signal.aborted)
        return;
      this.log.write(Resources.formatIgnoreCheckFailed(watched.worktree, String(error)));
      this.schedule(watched);
    }));
  }

  private static endTreeWaits(watched: WatchedWorktree): void {
    for (const timer of [watched.treeQuiet, watched.treeLongest])
      if (timer !== null)
        timers.clearTimeout(timer);
    watched.treeQuiet = null;
    watched.treeLongest = null;
  }

  private async startAsync(watched: WatchedWorktree, cookies: readonly WatchCookie[]): Promise<WatchStart> {
    for (const cookie of cookies)
      await this.removeLeftoversAsync(cookie.folder, cookie.name.endsWith(Resources.lockExtension));
    const tick = new AbortController();
    const ended = AbortSignal.any([tick.signal, watched.stop.signal]);
    let touching: Promise<void> = Promise.resolve();
    try {
      for (const cookie of cookies)
        await this.writeCookieAsync(cookie);
      touching = ChangeMonitor.touchAsync(cookies, ended);
      await Promise.race([
        Promise.all(cookies.map(async t => t.seen.promise)),
        ChangeMonitor.waitAsync(Resources.changePollMilliseconds, ended),
        touching
      ]);
    } finally {
      tick.abort();
      try {
        await touching;
      } finally {
        for (const cookie of cookies.filter(t => t.isWritten)) {
          await rm(cookie.file, { force: true });
          this.cookies.delete(cookie.file);
        }
      }
    }
    for (const cookie of cookies.filter(t => t.isWritten && !t.isSeen && !watched.stop.signal.aborted))
      this.log.write(Resources.formatCookieUnseen(cookie.folder));
    if (watched.stop.signal.aborted)
      return WatchStart.Stopped;
    return !watched.isPolledAlways && cookies.every(t => t.isSeen) ? WatchStart.Seen : WatchStart.Backstop;
  }

  private static async touchAsync(cookies: readonly WatchCookie[], signal: AbortSignal): Promise<void> {
    for (;;) {
      await ChangeMonitor.waitAsync(Resources.cookieTouchMilliseconds, signal);
      if (signal.aborted)
        return;
      for (const cookie of cookies.filter(t => t.isWritten && !t.isSeen)) {
        try {
          await writeFile(cookie.file, "");
        } catch (error) {
          if (!FilePresence.isUnwritable(error))
            throw error;
        }
      }
    }
  }

  private async removeLeftoversAsync(folder: string, isLock: boolean): Promise<void> {
    let names: string[];
    try {
      names = await readdir(folder);
    } catch (error) {
      if (FilePresence.isUnwritable(error))
        return;
      throw error;
    }
    for (const name of names) {
      const file = path.join(folder, name);
      if (name.startsWith(Resources.watchCookiePrefix) && name.endsWith(Resources.lockExtension) === isLock && !this.cookies.has(file))
        await rm(file, { force: true });
    }
  }

  private async writeCookieAsync(cookie: WatchCookie): Promise<void> {
    this.cookies.add(cookie.file);
    try {
      await writeFile(cookie.file, "", { flag: "wx" });
      cookie.isWritten = true;
    } catch (error) {
      this.cookies.delete(cookie.file);
      if (!FilePresence.isUnwritable(error))
        throw error;
      this.log.write(Resources.formatCookieUnwritten(cookie.folder, String(error)));
    }
  }

  private pollAlways(watched: WatchedWorktree): void {
    if (watched.isPolledAlways)
      return;
    watched.isPolledAlways = true;
    this.track(this.pollAsync(watched, watched.stop.signal, () => Resources.changePollMilliseconds));
  }

  private schedule(watched: WatchedWorktree): void {
    if (watched.writing > 0 || watched.isScheduled)
      return;
    watched.isScheduled = true;
    watched.running = watched.running.then(() => this.debounceAsync(watched));
    this.track(watched.running);
  }

  private track(work: Promise<void>): void {
    this.running.add(work);
    const done = (): void => void this.running.delete(work);
    void work.then(done, done);
  }

  private async debounceAsync(watched: WatchedWorktree): Promise<void> {
    await ChangeMonitor.waitAsync(Resources.changeDebounceMilliseconds, watched.stop.signal);
    if (watched.stop.signal.aborted)
      return;
    watched.isScheduled = false;
    await this.refreshAsync(watched);
  }

  private async pollAsync(watched: WatchedWorktree, signal: AbortSignal, interval: () => number): Promise<void> {
    for (;;) {
      await ChangeMonitor.waitAsync(interval(), signal);
      if (signal.aborted)
        return;
      this.schedule(watched);
    }
  }

  private static waitAsync(milliseconds: number, signal: AbortSignal): Promise<void> {
    if (signal.aborted)
      return Promise.resolve();
    return new Promise<void>(resolve => {
      const done = (): void => {
        timers.clearTimeout(timer);
        signal.removeEventListener("abort", done);
        resolve();
      };
      const timer: NodeJS.Timeout = timers.setTimeout(done, milliseconds);
      signal.addEventListener("abort", done, { once: true });
    });
  }

  private async refreshAsync(watched: WatchedWorktree): Promise<void> {
    if (watched.writing > 0)
      return;
    const generation = watched.generation;
    try {
      const { fingerprint } = await this.statuses.readAsync(watched.folders, watched.stop.signal);
      if (watched.stop.signal.aborted || watched.generation !== generation || fingerprint === watched.fingerprint)
        return;
      watched.fingerprint = fingerprint;
      this.onChanged(watched.key, ++this.sequence);
    } catch (error) {
      if (!watched.stop.signal.aborted)
        this.log.write(Resources.formatRefreshFailed(watched.worktree, String(error)));
    }
  }
}
