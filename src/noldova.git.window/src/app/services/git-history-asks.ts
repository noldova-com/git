/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { signal, type WritableSignal } from "@angular/core";
import "@noldova/context.core";

import { GitHistoryAsk } from "../models/git-history-ask.ts";

export class GitHistoryAsks {
  private static readonly asked: WritableSignal<GitHistoryAsk | null> = signal<GitHistoryAsk | null>(null);

  public static ask(folder: string, commitId: string): void {
    GitHistoryAsks.asked.set(new GitHistoryAsk(folder, commitId));
  }

  public static askedOf(folder: string): GitHistoryAsk | null {
    const asked: GitHistoryAsk | null = GitHistoryAsks.asked();
    return !Object.isNull(asked) && asked.folder === folder ? asked : null;
  }

  public static take(ask: GitHistoryAsk): void {
    if (GitHistoryAsks.asked() === ask)
      GitHistoryAsks.asked.set(null);
  }
}
