/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { type Signal, signal, type WritableSignal } from "@angular/core";
import type { IWindowPartContext } from "@noldova/desktop.window";

import type { IGitHostAccount } from "../interfaces/i-git-host-account.ts";
import type { IProvidedGitHostAccount } from "../interfaces/i-provided-git-host-account.ts";

export class GitHostAccounts {
  private static readonly provided: WritableSignal<readonly IProvidedGitHostAccount[]> = signal([]);
  private static readonly listeners: Set<(accounts: readonly IProvidedGitHostAccount[]) => void> = new Set();

  public static readonly accounts: Signal<readonly IProvidedGitHostAccount[]> = GitHostAccounts.provided.asReadonly();

  public static provide(context: IWindowPartContext, account: IGitHostAccount): () => void {
    const provided: IProvidedGitHostAccount = { context, account };
    GitHostAccounts.change(t => [...t, provided]);
    return () => GitHostAccounts.change(t => t.filter(u => u !== provided));
  }

  public static follow(listener: (accounts: readonly IProvidedGitHostAccount[]) => void): () => void {
    GitHostAccounts.listeners.add(listener);
    listener(GitHostAccounts.provided());
    return () => {
      GitHostAccounts.listeners.delete(listener);
    };
  }

  private static change(update: (accounts: readonly IProvidedGitHostAccount[]) => readonly IProvidedGitHostAccount[]): void {
    GitHostAccounts.provided.update(update);
    const accounts: readonly IProvidedGitHostAccount[] = GitHostAccounts.provided();
    for (const listener of [...GitHostAccounts.listeners])
      listener(accounts);
  }
}
