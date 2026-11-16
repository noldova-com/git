/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { signal, type WritableSignal } from "@angular/core";
import type { IWindowPartContext } from "@noldova/desktop.window";
import type { GitRemote } from "@noldova/git.protocol";

import type { IGitHostRow } from "../interfaces/i-git-host-row.ts";
import type { IProvidedGitHostRow } from "../interfaces/i-provided-git-host-row.ts";
import { Resources } from "../../resources.ts";

export class GitHostRows {
  private static readonly rows: WritableSignal<readonly IProvidedGitHostRow[]> = signal([]);

  public static provide(context: IWindowPartContext, row: IGitHostRow): () => void {
    const provided: IProvidedGitHostRow = { context, row };
    GitHostRows.rows.update(t => [...t, provided]);
    return () => GitHostRows.rows.update(t => t.filter(u => u !== provided));
  }

  public static rowFor(remote: GitRemote): IProvidedGitHostRow | null {
    for (const provided of GitHostRows.rows())
      try {
        if (provided.row.claims(remote))
          return provided;
      }
      catch (error) {
        provided.context.log(Resources.formatHostRowFailed(String(error)));
      }
    return null;
  }
}
