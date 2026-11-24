/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { signal, type Signal, type WritableSignal } from "@angular/core";

import type { IGitAgents } from "../interfaces/i-git-agents.ts";

/** The agent runs modules give the repository panel, listed in the order the modules gave them. */
export class GitAgents {
  private static readonly provided: WritableSignal<readonly IGitAgents[]> = signal([]);

  /** Every provider given and not yet removed; the panel lists their runs together. */
  public static readonly all: Signal<readonly IGitAgents[]> = GitAgents.provided.asReadonly();

  /**
   * Gives the panel a module's agent runs, until the returned function removes them.
   * @example
   * const remove = GitAgents.provide({ listFor: folder => runs.of(folder), open: (folder, row) => runs.show(row.key) });
   */
  public static provide(agents: IGitAgents): () => void {
    GitAgents.provided.update(t => [...t, agents]);
    return () => GitAgents.provided.update(t => t.filter(u => u !== agents));
  }
}
