/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */
import type { JsonValue } from "@noldova/context.json";
import { GitJournal, GitJournalEntry, UndoMode } from "@noldova/git.protocol";

import type { IWriteCheckpoint } from "../interfaces/i-write-checkpoint.ts";
import { RefSnapshot } from "../models/ref-snapshot.ts";
import { Resources } from "../resources.ts";

/**
 * Each repository's recent writes, by its common Git folder, so worktrees share one journal: the refs each write moved, from snapshots taken
 * before and after it, and how it is undone. It lives while the module runs and keeps the last writes, 50 unless the person's
 * `git.undoHistory` setting asks for another number from 1 to 500.
 */
export class Journal {
  private readonly entries: Map<string, GitJournalEntry[]> = new Map();
  /** The git folder of the worktree each kept entry was written in, by the entry's id. */
  private readonly worktrees: Map<string, string> = new Map();
  private readonly now: () => Date;
  private readonly limit: () => JsonValue;
  private next: number = 1;

  public constructor(now: () => Date = () => new Date(), limit: () => JsonValue = () => Resources.journalLimit) {
    this.now = now;
    this.limit = limit;
  }

  /** The number of writes kept: the setting's whole number from 1 to 500, or 50 for anything else. */
  public static limitOf(value: JsonValue): number {
    return typeof value === "number" && Number.isInteger(value) && value >= Resources.journalLimitMinimum && value <= Resources.journalLimitMaximum
      ? value
      : Resources.journalLimit;
  }

  /** @param gitFolder The git folder of the worktree the write ran in, its own one rather than the common one its worktrees share. */
  public record(commonGitFolder: string, gitFolder: string, method: string, undo: UndoMode, before: RefSnapshot, after: RefSnapshot, checkpoint: IWriteCheckpoint | null = null): GitJournalEntry {
    const hasIndex = undo === UndoMode.Index && before.index !== null && after.index !== null;
    const entry = new GitJournalEntry(
      String(this.next++),
      method,
      this.now().toISOString().replace(Resources.millisecondsPattern, Resources.utcSuffix),
      before.branch,
      after.branch,
      RefSnapshot.movesBetween(before, after),
      undo === UndoMode.Index && !hasIndex ? UndoMode.None : undo,
      hasIndex ? before.index : null,
      hasIndex ? after.index : null,
      checkpoint?.id ?? null,
      checkpoint?.paths ?? []);
    const list = this.entries.get(commonGitFolder) ?? [];
    list.push(entry);
    this.worktrees.set(entry.id, gitFolder);
    for (const dropped of list.splice(0, Math.max(0, list.length - Journal.limitOf(this.limit()))))
      this.worktrees.delete(dropped.id);
    this.entries.set(commonGitFolder, list);
    return entry;
  }

  public read(commonGitFolder: string, checkpoints: boolean = false): GitJournal {
    return new GitJournal([...this.entries.get(commonGitFolder) ?? []], checkpoints);
  }

  public find(commonGitFolder: string, id: string): GitJournalEntry | null {
    return this.entries.get(commonGitFolder)?.find(t => t.id === id) ?? null;
  }

  /** The git folder of the worktree a kept entry was written in, or null once the entry is no longer kept. */
  public worktreeOf(id: string): string | null {
    return this.worktrees.get(id) ?? null;
  }

  /** Takes an undone entry out, so it can't be undone twice. */
  public remove(commonGitFolder: string, id: string): void {
    const list = this.entries.get(commonGitFolder) ?? [];
    this.entries.set(commonGitFolder, list.filter(t => t.id !== id));
    this.worktrees.delete(id);
  }
}
