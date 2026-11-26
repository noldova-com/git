/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { signal, type WritableSignal } from "@angular/core";
import "@noldova/context.core";
import type { IWindowPartContext } from "@noldova/desktop.window";

import type { IGitCommitPrefixes } from "../interfaces/i-git-commit-prefixes.ts";
import type { IProvidedGitCommitPrefixes } from "../interfaces/i-provided-git-commit-prefixes.ts";
import { Resources } from "../../resources.ts";

export class GitCommitPrefixes {
  private static readonly provided: WritableSignal<readonly IProvidedGitCommitPrefixes[]> = signal([]);

  public static provide(context: IWindowPartContext, prefixes: IGitCommitPrefixes): () => void {
    const provided: IProvidedGitCommitPrefixes = { context, prefixes };
    GitCommitPrefixes.provided.update(t => [...t, provided]);
    return () => GitCommitPrefixes.provided.update(t => t.filter(u => u !== provided));
  }

  public static prefixFor(folder: string, branch: string): string | null {
    for (const provided of GitCommitPrefixes.provided())
      try {
        const prefix: string | null = provided.prefixes.prefixFor(folder, branch);
        if (!Object.isNull(prefix))
          return prefix;
      }
      catch (error) {
        provided.context.log(Resources.formatCommitPrefixFailed(String(error)));
      }
    return null;
  }
}
