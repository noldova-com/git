/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Component, computed, ErrorHandler, inject, input, type InputSignal, signal, type Signal, type WritableSignal } from "@angular/core";

import { GitAgentState } from "../../enums/git-agent-state.ts";
import type { IGitAgents } from "../../interfaces/i-git-agents.ts";
import type { GitAgentRow } from "../../models/git-agent-row.ts";
import { GitAgents } from "../../services/git-agents.ts";
import { Resources } from "../../../resources.ts";

interface IListedRun {
  readonly provider: IGitAgents;
  readonly row: GitAgentRow;
}

@Component({
  selector: "nol-git-agents",
  templateUrl: "./git-agents.component.html",
  styleUrl: "./git-agents.component.css"
})
export class GitAgentsComponent {
  private readonly errors: ErrorHandler = inject(ErrorHandler);

  public readonly folder: InputSignal<string> = input.required<string>();

  protected readonly resources: typeof Resources = Resources;
  protected readonly isOpen: WritableSignal<boolean> = signal(true);
  protected readonly hasProvider: Signal<boolean> = computed(() => GitAgents.all().length > 0);
  protected readonly runs: Signal<readonly IListedRun[]> = computed(() => GitAgents.all().flatMap(provider =>
    this.attempt(() => provider.listFor(this.folder())() ?? [], []).map(row => ({ provider, row }))));
  protected readonly worktrees: Signal<number> = computed(() => new Set(this.runs().map(t => t.row.worktree)).size);

  protected toggle(): void {
    this.isOpen.update(t => !t);
  }

  protected iconOf(state: GitAgentState): string {
    return Resources.agentStateIcons[state];
  }

  protected labelOf(state: GitAgentState): string {
    return Resources.agentStateLabels[state];
  }

  protected open(run: IListedRun): void {
    this.attempt(() => run.provider.open(this.folder(), run.row), undefined);
  }

  private attempt<T>(run: () => T, fallback: T): T {
    try {
      return run();
    }
    catch (error) {
      this.errors.handleError(error);
      return fallback;
    }
  }
}
