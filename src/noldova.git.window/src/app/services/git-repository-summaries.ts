/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { signal, type Signal, type WritableSignal } from "@angular/core";
import "@noldova/context.core";
import type { IWindowPartContext } from "@noldova/desktop.window";
import type { GitStatus } from "@noldova/git.protocol";

import { GitRepositorySummary } from "../models/git-repository-summary.ts";
import { GitRuntimeClient } from "./git-runtime-client.ts";
import { GitViewStateService } from "./git-view-state.service.ts";

export class GitRepositorySummaries {
  /** How many repositories a read, a fetch or a bulk write of the workspace works on at a time. */
  public static readonly AT_ONCE: number = 4;

  private readonly context: IWindowPartContext;
  private readonly client: GitRuntimeClient;
  private readonly summaries: Map<string, WritableSignal<GitRepositorySummary | null>> = new Map();
  private readonly watchers: Map<string, number> = new Map();
  private readonly reading: Set<string> = new Set();
  private readonly readAgain: Set<string> = new Set();
  /** The folders {@link readMissingAsync} read while no row followed them, whose first watch needs no read of its own. */
  private readonly fresh: Set<string> = new Set();
  private readonly fetching: Set<string> = new Set();
  private readonly unfollow: () => void;

  public constructor(context: IWindowPartContext) {
    this.context = context;
    this.client = new GitRuntimeClient(context);
    this.unfollow = this.client.onChanged(folder => {
      if (this.watchers.has(folder))
        void this.readAsync(folder);
    });
  }

  public summaryOf(folder: string): Signal<GitRepositorySummary | null> {
    return this.summarySignalOf(folder).asReadonly();
  }

  public watch(folder: string): void {
    const count: number = this.watchers.get(folder) ?? 0;
    this.watchers.set(folder, count + 1);
    if (count > 0)
      return;
    void this.client.watchAsync(folder).catch((error: unknown) => this.context.log(GitRepositorySummaries.formatWatchFailed(folder, GitViewStateService.messageOf(error))));
    if (!this.fresh.delete(folder) && !this.reading.has(folder))
      void this.readAsync(folder);
  }

  public unwatch(folder: string): void {
    const count: number | undefined = this.watchers.get(folder);
    if (Object.isUndefined(count))
      return;
    if (count > 1) {
      this.watchers.set(folder, count - 1);
      return;
    }
    this.watchers.delete(folder);
    this.stopWatching(folder);
  }

  public refreshAllAsync(folders: readonly string[]): Promise<void> {
    return GitRepositorySummaries.eachAsync(folders, t => this.readAsync(t));
  }

  /**
   * Reads each folder that, when its turn comes, has no summary and no read underway, at most {@link AT_ONCE} at a time: such as when a page
   * opens, and the rows on screen have read their own first. A folder it reads before its row is followed isn't read again when it is.
   */
  public readMissingAsync(folders: readonly string[]): Promise<void> {
    return GitRepositorySummaries.eachAsync(folders, async t => {
      if (!Object.isNull(this.summarySignalOf(t)()) || this.reading.has(t))
        return;
      await this.readAsync(t);
      if (!this.watchers.has(t))
        this.fresh.add(t);
    });
  }

  public fetchAllAsync(folders: readonly string[]): Promise<void> {
    return GitRepositorySummaries.eachAsync(folders, t => this.fetchAsync(t));
  }

  public dispose(): void {
    this.unfollow();
    for (const folder of this.watchers.keys())
      this.stopWatching(folder);
    this.watchers.clear();
  }

  /** Runs the work on each item once, at most {@link AT_ONCE} at a time. */
  public static async eachAsync<T>(items: readonly T[], work: (item: T) => Promise<void>): Promise<void> {
    const queue: T[] = [...new Set(items)];
    const next = async (): Promise<void> => {
      for (let item: T | undefined = queue.shift(); !Object.isUndefined(item); item = queue.shift())
        await work(item);
    };
    await Promise.all(Array.from({ length: Math.min(GitRepositorySummaries.AT_ONCE, queue.length) }, next));
  }

  private static formatWatchFailed(folder: string, reason: string): string {
    return `Changes in ${folder} made outside the workspace aren't followed, since the folder couldn't be watched: ${reason}`;
  }

  private static formatUnwatchFailed(folder: string, reason: string): string {
    return `The workspace couldn't stop watching ${folder}: ${reason}`;
  }

  private summarySignalOf(folder: string): WritableSignal<GitRepositorySummary | null> {
    let summary: WritableSignal<GitRepositorySummary | null> | undefined = this.summaries.get(folder);
    if (Object.isUndefined(summary)) {
      summary = signal<GitRepositorySummary | null>(null);
      this.summaries.set(folder, summary);
    }
    return summary;
  }

  private stopWatching(folder: string): void {
    void this.client.unwatchAsync(folder).catch((error: unknown) => this.context.log(GitRepositorySummaries.formatUnwatchFailed(folder, GitViewStateService.messageOf(error))));
  }

  private async readAsync(folder: string): Promise<void> {
    if (this.reading.has(folder)) {
      this.readAgain.add(folder);
      return;
    }
    this.reading.add(folder);
    try {
      do {
        this.readAgain.delete(folder);
        await this.showStatusAsync(folder);
      } while (this.readAgain.has(folder));
    }
    finally {
      this.reading.delete(folder);
    }
  }

  private async showStatusAsync(folder: string): Promise<void> {
    const summary: WritableSignal<GitRepositorySummary | null> = this.summarySignalOf(folder);
    try {
      const status: GitStatus = await this.client.statusAsync(folder);
      summary.set(new GitRepositorySummary(folder, status, this.fetching.has(folder), null));
    }
    catch (error) {
      summary.set(new GitRepositorySummary(folder, null, this.fetching.has(folder), GitViewStateService.messageOf(error)));
    }
  }

  private async fetchAsync(folder: string): Promise<void> {
    if (this.fetching.has(folder))
      return;
    const summary: WritableSignal<GitRepositorySummary | null> = this.summarySignalOf(folder);
    const shown: GitRepositorySummary = summary() ?? new GitRepositorySummary(folder, null, false, null);
    this.fetching.add(folder);
    summary.set(shown.asFetching());
    try {
      const status: GitStatus = await this.client.statusAsync(folder);
      await this.client.fetchAsync(folder, status.fingerprint);
      this.fetching.delete(folder);
      await this.readAsync(folder);
    }
    catch (error) {
      this.fetching.delete(folder);
      summary.set(shown.withFailure(GitViewStateService.messageOf(error)));
    }
  }
}
