/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { Signal } from "@angular/core";

import type { GitAgentRow } from "../models/git-agent-row.ts";

export interface IGitAgents {
  listFor(folder: string): Signal<readonly GitAgentRow[] | null>;

  open(folder: string, row: GitAgentRow): void;
}
