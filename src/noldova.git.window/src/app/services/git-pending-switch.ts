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

export class GitPendingSwitch {
  public static readonly target: WritableSignal<GitSwitchTarget | null> = signal<GitSwitchTarget | null>(null);

  public static branchOf(folder: string | null): string | null {
    const target: GitSwitchTarget | null = GitPendingSwitch.target();
    return !Object.isNull(target) && target.folder === folder ? target.branch : null;
  }

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
