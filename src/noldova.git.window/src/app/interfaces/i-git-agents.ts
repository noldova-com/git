/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { Signal } from "@angular/core";

import type { GitAgentRow } from "../models/git-agent-row.ts";

/** What a module that runs agents gives the repository panel so that it lists the agents working in a repository. */
export interface IGitAgents {
  /**
   * The runs working in the repository or its worktrees, newest first, or null before the provider has any answer.
   * The panel reads it inside a computed signal, so the provider answers the same signal for a folder each time and updates it.
   */
  listFor(folder: string): Signal<readonly GitAgentRow[] | null>;

  /** Shows the run, such as in the provider's own view; the panel calls it when the person clicks the run's row. */
  open(folder: string, row: GitAgentRow): void;
}
