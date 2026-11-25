/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { signal, type WritableSignal } from "@angular/core";
import "@noldova/context.core";

import { GitSwitchTarget } from "../models/git-switch-target.ts";

/** The branch a switch is moving to while git runs it, so every Git view names it at once rather than after the switch and the reads that follow. */
export class GitPendingSwitch {
  public static readonly target: WritableSignal<GitSwitchTarget | null> = signal<GitSwitchTarget | null>(null);

  /** The branch a folder is switching to, or `null` when it isn't switching. */
  public static branchOf(folder: string | null): string | null {
    const target: GitSwitchTarget | null = GitPendingSwitch.target();
    return !Object.isNull(target) && target.folder === folder ? target.branch : null;
  }

  /** Names the branch while the switch runs, and forgets it once the switch ends, whether it ran or failed. */
  public static async runAsync(folder: string, branch: string, switchAsync: () => Promise<void>): Promise<void> {
    const target: GitSwitchTarget = new GitSwitchTarget(folder, branch);
    GitPendingSwitch.target.set(target);
    try {
      await switchAsync();
    }
    finally {
      if (GitPendingSwitch.target() === target)
        GitPendingSwitch.target.set(null);
    }
  }
}
