/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Component, computed, inject, type Signal } from "@angular/core";
import { type IWindowPartContext, WindowPartTokens } from "@noldova/desktop.window";
import type { GitOperation } from "@noldova/git.protocol";
import { ButtonComponent, ButtonVariant } from "@noldova/ui.components.angular";

import { GitViewPhase } from "../../enums/git-view-phase.ts";
import { GitEmptyState } from "../../models/git-empty-state.ts";
import { Resources } from "../../../resources.ts";
import { GitViewStateService } from "../../services/git-view-state.service.ts";
import { GitBranchCardComponent } from "../git-branch-card/git-branch-card.component.ts";
import { GitCommitCardComponent } from "../git-commit-card/git-commit-card.component.ts";
import { GitFileGroupComponent } from "../git-file-group/git-file-group.component.ts";
import { GitHostRowComponent } from "../git-host-row/git-host-row.component.ts";

@Component({
  selector: "nol-git-view",
  imports: [ButtonComponent, GitBranchCardComponent, GitCommitCardComponent, GitFileGroupComponent, GitHostRowComponent],
  providers: [GitViewStateService],
  templateUrl: "./git-view.component.html",
  styleUrl: "./git-view.component.css"
})
export class GitViewComponent {
  private readonly context: IWindowPartContext = inject(WindowPartTokens.context);

  protected readonly resources: typeof Resources = Resources;
  protected readonly phases: typeof GitViewPhase = GitViewPhase;
  protected readonly secondary: ButtonVariant = ButtonVariant.Secondary;
  protected readonly state: GitViewStateService = inject(GitViewStateService);
  protected readonly empty: Signal<GitEmptyState | null> = computed(() => this.emptyOf(this.state.phase()));
  protected readonly offersGit: Signal<boolean> = computed(() => this.state.phase() === GitViewPhase.GitMissing || this.state.phase() === GitViewPhase.GitTooOld);

  protected getGit(): void {
    void this.context.openLinkAsync(Resources.getGitAddress);
  }

  protected checkAgain(): void {
    void this.state.refreshAsync();
  }

  protected followAgain(): void {
    void this.state.followAgainAsync();
  }

  protected dismissFailure(): void {
    this.state.failure.set(null);
  }

  protected operationOf(operation: GitOperation | null): string | null {
    return operation === null ? null : Resources.formatOperation(Resources.operations[operation.kind], operation.from);
  }

  private emptyOf(phase: GitViewPhase): GitEmptyState | null {
    switch (phase) {
      case GitViewPhase.NoFolder:
        return new GitEmptyState(Resources.noFolderIcon, Resources.noFolderHeading, Resources.noFolderText);
      case GitViewPhase.NotRepository:
        return new GitEmptyState(Resources.noFolderIcon, Resources.notRepositoryHeading, Resources.formatNotRepositoryText(this.state.readFolder()));
      case GitViewPhase.FolderUnreadable:
        return new GitEmptyState(Resources.folderUnreadableIcon, Resources.folderUnreadableHeading, Resources.formatFolderUnreadableText(this.state.readFolder()));
      case GitViewPhase.GitMissing:
        return new GitEmptyState(Resources.gitMissingIcon, Resources.gitMissingHeading, Resources.gitMissingText);
      case GitViewPhase.GitTooOld:
        return new GitEmptyState(Resources.gitTooOldIcon, Resources.formatGitTooOldHeading(this.state.gitVersion()), Resources.gitTooOldText);
      case GitViewPhase.Failed:
        return new GitEmptyState(Resources.failureIcon, Resources.failedHeading, this.state.readFailure());
      case GitViewPhase.FolderFailed:
        return new GitEmptyState(Resources.failureIcon, Resources.folderFailedHeading, this.state.readFailure());
      default:
        return null;
    }
  }
}
