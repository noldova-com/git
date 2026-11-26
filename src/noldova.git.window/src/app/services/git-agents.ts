/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { signal, type Signal, type WritableSignal } from "@angular/core";

import type { IGitAgents } from "../interfaces/i-git-agents.ts";

export class GitAgents {
  private static readonly provided: WritableSignal<readonly IGitAgents[]> = signal([]);

  public static readonly all: Signal<readonly IGitAgents[]> = GitAgents.provided.asReadonly();

  public static provide(agents: IGitAgents): () => void {
    GitAgents.provided.update(t => [...t, agents]);
    return () => GitAgents.provided.update(t => t.filter(u => u !== agents));
  }
}
