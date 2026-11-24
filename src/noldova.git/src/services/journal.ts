/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */
import { GitJournal, GitJournalEntry, UndoMode } from "@noldova/git.protocol";

import type { IWriteCheckpoint } from "../interfaces/i-write-checkpoint.ts";
import { RefSnapshot } from "../models/ref-snapshot.ts";
import { Resources } from "../resources.ts";

/**
 * Each repository's recent writes, by its common Git folder, so worktrees share one journal: the refs each write moved, from snapshots taken
 * before and after it, and how it is undone. It lives while the module runs and keeps the last 50 writes.
 */
export class Journal {
  private readonly entries: Map<string, GitJournalEntry[]> = new Map();
  private readonly now: () => Date;
  private next: number = 1;

  public constructor(now: () => Date = () => new Date()) {
    this.now = now;
  }

  public record(commonGitFolder: string, method: string, undo: UndoMode, before: RefSnapshot, after: RefSnapshot, checkpoint: IWriteCheckpoint | null = null): GitJournalEntry {
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
    list.splice(0, Math.max(0, list.length - Resources.journalLimit));
    this.entries.set(commonGitFolder, list);
    return entry;
  }

  public read(commonGitFolder: string, checkpoints: boolean = false): GitJournal {
    return new GitJournal([...this.entries.get(commonGitFolder) ?? []], checkpoints);
  }

  public find(commonGitFolder: string, id: string): GitJournalEntry | null {
    return this.entries.get(commonGitFolder)?.find(t => t.id === id) ?? null;
  }

  /** Takes an undone entry out, so it can't be undone twice. */
  public remove(commonGitFolder: string, id: string): void {
    const list = this.entries.get(commonGitFolder) ?? [];
    this.entries.set(commonGitFolder, list.filter(t => t.id !== id));
  }
}
