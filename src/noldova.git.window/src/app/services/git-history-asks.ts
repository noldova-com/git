/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { signal, type WritableSignal } from "@angular/core";

import { GitHistoryAsk } from "../models/git-history-ask.ts";

/** The commit another page last asked a history to select, kept until that repository's history takes it. */
export class GitHistoryAsks {
  private static readonly asked: WritableSignal<GitHistoryAsk | null> = signal<GitHistoryAsk | null>(null);

  public static ask(folder: string, commitId: string): void {
    GitHistoryAsks.asked.set(new GitHistoryAsk(folder, commitId));
  }

  /** The commit asked of a folder's history, or null when none waits for it. */
  public static askedOf(folder: string): GitHistoryAsk | null {
    const asked: GitHistoryAsk | null = GitHistoryAsks.asked();
    return asked !== null && asked.folder === folder ? asked : null;
  }

  /** Marks an ask as taken, unless a newer one replaced it. */
  public static take(ask: GitHistoryAsk): void {
    if (GitHistoryAsks.asked() === ask)
      GitHistoryAsks.asked.set(null);
  }
}
