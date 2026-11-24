/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { signal, type WritableSignal } from "@angular/core";
import type { IWindowPartContext } from "@noldova/desktop.window";

import type { IGitCommitPrefixes } from "../interfaces/i-git-commit-prefixes.ts";
import type { IProvidedGitCommitPrefixes } from "../interfaces/i-provided-git-commit-prefixes.ts";
import { Resources } from "../../resources.ts";

/** The commit message prefixes host modules give the commit box, with the context each was given by, asked in the order they were given. */
export class GitCommitPrefixes {
  private static readonly provided: WritableSignal<readonly IProvidedGitCommitPrefixes[]> = signal([]);

  public static provide(context: IWindowPartContext, prefixes: IGitCommitPrefixes): () => void {
    const provided: IProvidedGitCommitPrefixes = { context, prefixes };
    GitCommitPrefixes.provided.update(t => [...t, provided]);
    return () => GitCommitPrefixes.provided.update(t => t.filter(u => u !== provided));
  }

  /** The first prefix a host gives the branch, logging to its own part a host whose answer throws and passing over it. */
  public static prefixFor(folder: string, branch: string): string | null {
    for (const provided of GitCommitPrefixes.provided())
      try {
        const prefix: string | null = provided.prefixes.prefixFor(folder, branch);
        if (prefix !== null)
          return prefix;
      }
      catch (error) {
        provided.context.log(Resources.formatCommitPrefixFailed(String(error)));
      }
    return null;
  }
}
