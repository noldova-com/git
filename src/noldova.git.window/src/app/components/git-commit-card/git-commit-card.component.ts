/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Component, computed, inject, input, type InputSignal, type Signal } from "@angular/core";
import { FormsModule } from "@angular/forms";
import type { GitStatus } from "@noldova/git.protocol";
import { ButtonComponent, TextFieldComponent } from "@noldova/ui.components.angular";

import { Resources } from "../../../resources.ts";
import { GitViewStateService } from "../../services/git-view-state.service.ts";

@Component({
  selector: "nol-git-commit-card",
  imports: [ButtonComponent, FormsModule, TextFieldComponent],
  templateUrl: "./git-commit-card.component.html",
  styleUrl: "./git-commit-card.component.css"
})
export class GitCommitCardComponent {
  protected readonly resources: typeof Resources = Resources;
  protected readonly state: GitViewStateService = inject(GitViewStateService);
  protected readonly placeholder: Signal<string> = computed(() => this.status().operation?.message ?? Resources.messagePlaceholder);
  protected readonly label: Signal<string> = computed(() =>
    this.status().operation !== null ? Resources.commitMergeLabel : this.state.staged() > 0 ? Resources.formatCommit(this.state.staged()) : Resources.commitLabel);
  protected readonly hint: Signal<string | null> = computed(() =>
    this.status().operation !== null && this.state.conflicts() > 0 ? Resources.formatConflictHint(this.state.conflicts()) : null);
  protected readonly message: Signal<string> = computed(() => {
    const typed: string = this.state.message().trim();
    return typed.length > 0 ? typed : this.status().operation?.message ?? "";
  });
  protected readonly canCommit: Signal<boolean> = computed(() =>
    !this.state.busy() && this.state.conflicts() === 0 && this.message().length > 0 && (this.state.staged() > 0 || this.status().operation !== null));

  public readonly status: InputSignal<GitStatus> = input.required<GitStatus>();

  protected commit(): void {
    void this.state.commitAsync(this.message());
  }
}
