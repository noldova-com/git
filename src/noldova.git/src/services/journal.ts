/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */
import "@noldova/context.core";
import type { JsonValue } from "@noldova/context.json";
import { GitJournal, GitJournalEntry, UndoMode } from "@noldova/git.protocol";

import type { IWriteCheckpoint } from "../interfaces/i-write-checkpoint.ts";
import { RefSnapshot } from "../models/ref-snapshot.ts";
import { Resources } from "../resources.ts";

export class Journal {
  private readonly entries: Map<string, GitJournalEntry[]> = new Map();
  private readonly worktrees: Map<string, string> = new Map();
  private readonly now: () => Date;
  private readonly limit: () => JsonValue;
  private next: number = 1;

  public constructor(now: () => Date = () => new Date(), limit: () => JsonValue = () => Resources.journalLimit) {
    this.now = now;
    this.limit = limit;
  }

  public static limitOf(value: JsonValue): number {
    return Object.isNumber(value) && Number.isInteger(value) && value >= Resources.journalLimitMinimum && value <= Resources.journalLimitMaximum
      ? value
      : Resources.journalLimit;
  }

  public record(commonGitFolder: string, gitFolder: string, method: string, undo: UndoMode, before: RefSnapshot, after: RefSnapshot, checkpoint: IWriteCheckpoint | null = null): GitJournalEntry {
    const hasIndex = undo === UndoMode.Index && !Object.isNull(before.index) && !Object.isNull(after.index);
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

  public worktreeOf(id: string): string | null {
    return this.worktrees.get(id) ?? null;
  }

  public remove(commonGitFolder: string, id: string): void {
    const list = this.entries.get(commonGitFolder) ?? [];
    this.entries.set(commonGitFolder, list.filter(t => t.id !== id));
    this.worktrees.delete(id);
  }
}
