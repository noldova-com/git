/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Component, computed, inject, input, type InputSignal, type Signal } from "@angular/core";
import { FormsModule } from "@angular/forms";
import "@noldova/context.core";
import type { GitCommitSigning, GitOperation, GitStatus } from "@noldova/git.protocol";
import { ButtonComponent, ButtonVariant, TextFieldComponent } from "@noldova/ui.components.angular";

import { Resources } from "../../../resources.ts";
import { GitViewOptions } from "../../services/git-view-options.ts";
import { GitViewStateService } from "../../services/git-view-state.service.ts";

@Component({
  selector: "nol-git-commit-card",
  imports: [ButtonComponent, FormsModule, TextFieldComponent],
  templateUrl: "./git-commit-card.component.html",
  styleUrl: "./git-commit-card.component.css"
})
export class GitCommitCardComponent {
  protected readonly resources: typeof Resources = Resources;
  protected readonly showsAiFeatures: Signal<boolean> = GitViewOptions.showsAiFeatures;
  protected readonly secondary: ButtonVariant = ButtonVariant.Secondary;
  protected readonly state: GitViewStateService = inject(GitViewStateService);
  protected readonly placeholder: Signal<string> = computed(() => this.status().operation?.message ?? Resources.messagePlaceholder);
  protected readonly canAmend: Signal<boolean> = computed(() => {
    const status: GitStatus = this.status();
    return !Object.isNull(status.head) && Object.isNull(status.operation) && !(!Object.isNull(status.upstream) && !status.upstream.gone && status.upstream.ahead === 0);
  });
  protected readonly amendTitle: Signal<string> = computed(() => this.canAmend() || this.state.amending() ? Resources.amendTitle : Resources.amendPushedTitle);
  protected readonly label: Signal<string> = computed(() => {
    const operation: GitOperation | null = this.status().operation;
    if (this.state.amending())
      return Resources.amendCommitLabel;
    if (!Object.isNull(operation))
      return Resources.commitOperationLabels[operation.kind];
    return this.state.staged() > 0 ? Resources.formatCommit(this.state.staged()) : Resources.commitLabel;
  });
  protected readonly hint: Signal<string | null> = computed(() => {
    const operation: GitOperation | null = this.status().operation;
    return !Object.isNull(operation) && this.state.conflicts() > 0 ? Resources.formatConflictHint(this.state.conflicts(), operation.kind) : null;
  });
  protected readonly message: Signal<string> = computed(() => {
    const typed: string = this.state.message().trim();
    return typed.length > 0 ? typed : this.status().operation?.message ?? "";
  });
  protected readonly canCommit: Signal<boolean> = computed(() =>
    !this.state.busy() && this.state.conflicts() === 0 && this.message().length > 0
    && (this.state.amending() ? this.canAmend() : this.state.staged() > 0 || !Object.isNull(this.status().operation)));

  protected readonly canPush: Signal<boolean> = computed(() => !this.state.amending() && Object.isNull(this.status().operation) && !Object.isNull(this.status().upstream));

  protected readonly signingNote: Signal<string | null> = computed(() => {
    const signing: GitCommitSigning | null = this.state.commitSigning();
    return signing?.signs === true && !Object.isNull(signing.format) ? Resources.signingNotes[signing.format] : null;
  });

  public readonly status: InputSignal<GitStatus> = input.required<GitStatus>();

  protected toggleAmend(checked: boolean): void {
    void this.state.setAmendingAsync(checked);
  }

  protected commit(): void {
    void this.state.commitAsync(this.message());
  }

  protected commitAndPush(): void {
    void this.state.commitAndPushAsync(this.message());
  }
}
