/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Component, computed, DestroyRef, ElementRef, ErrorHandler, inject, type Signal, signal, type WritableSignal } from "@angular/core";
import { type IWindowPartContext, WindowException, WindowPartTokens } from "@noldova/desktop.window";
import type { GitOperation } from "@noldova/git.protocol";
import { ButtonComponent, ButtonVariant, DialogService, SpinnerComponent } from "@noldova/ui.components.angular";

import { GitFileGroupKind } from "../../enums/git-file-group-kind.ts";
import { GitViewPhase } from "../../enums/git-view-phase.ts";
import type { GitForcePushOffer } from "../../models/git-force-push-offer.ts";
import { GitEmptyState } from "../../models/git-empty-state.ts";
import { GitOperationName } from "../../models/git-operation-name.ts";
import { Resources } from "../../../resources.ts";
import { FocusKeeper } from "../../services/focus-keeper.ts";
import { GitPendingSwitch } from "../../services/git-pending-switch.ts";
import { GitResolving } from "../../services/git-resolving.ts";
import { GitViewOptions } from "../../services/git-view-options.ts";
import { GitViewStateService } from "../../services/git-view-state.service.ts";
import { GitBranchCardComponent } from "../git-branch-card/git-branch-card.component.ts";
import { GitCommitCardComponent } from "../git-commit-card/git-commit-card.component.ts";
import { GitFileGroupComponent } from "../git-file-group/git-file-group.component.ts";
import { GitForcePushDialogComponent } from "../git-force-push-dialog/git-force-push-dialog.component.ts";
import { GitHostRowComponent } from "../git-host-row/git-host-row.component.ts";
import { GitUndoMenuComponent } from "../git-undo-menu/git-undo-menu.component.ts";

@Component({
  selector: "nol-git-view",
  imports: [ButtonComponent, GitBranchCardComponent, GitCommitCardComponent, GitFileGroupComponent, GitHostRowComponent, GitUndoMenuComponent,
    SpinnerComponent],
  providers: [GitViewStateService],
  templateUrl: "./git-view.component.html",
  styleUrl: "./git-view.component.css"
})
export class GitViewComponent {
  private readonly context: IWindowPartContext = inject(WindowPartTokens.context);
  private readonly dialogs: DialogService = inject(DialogService);

  protected readonly resources: typeof Resources = Resources;
  protected readonly phases: typeof GitViewPhase = GitViewPhase;
  private readonly errors: ErrorHandler = inject(ErrorHandler);
  protected readonly secondary: ButtonVariant = ButtonVariant.Secondary;
  protected readonly state: GitViewStateService = inject(GitViewStateService);
  protected readonly showsBranch: Signal<boolean> = GitViewOptions.showsBranch;
  protected readonly switching: Signal<string | null> = computed(() => GitPendingSwitch.branchOf(this.state.folder()));
  protected readonly empty: Signal<GitEmptyState | null> = computed(() => this.emptyOf(this.state.phase()));
  protected readonly linkFailed: WritableSignal<boolean> = signal(false);
  protected readonly firstConflict: Signal<string | null> = computed(() =>
    this.state.groups().filter(t => t.kind === GitFileGroupKind.Conflicts).flatMap(t => t.rows)[0]?.path ?? null);
  protected readonly offersGit: Signal<boolean> = computed(() => this.state.phase() === GitViewPhase.GitMissing || this.state.phase() === GitViewPhase.GitTooOld);

  public constructor() {
    inject(DestroyRef).onDestroy(FocusKeeper.keep(inject<ElementRef<HTMLElement>>(ElementRef).nativeElement));
  }

  protected async getGitAsync(): Promise<void> {
    this.linkFailed.set(false);
    try {
      await this.context.openLinkAsync(Resources.getGitAddress);
    }
    catch (error) {
      if (!(error instanceof WindowException))
        throw error;
      this.context.log(Resources.formatLinkFailed(Resources.getGitAddress, String(error)));
      this.linkFailed.set(true);
    }
  }

  protected checkAgain(): void {
    void this.state.refreshAsync();
  }

  protected followAgain(): void {
    void this.state.followAgainAsync();
  }

  protected openConflict(folder: string, path: string): void {
    GitResolving.open(folder, path);
    this.context.openDocument(Resources.conflictsDocumentName, folder, Resources.formatConflictsTitle(folder));
  }

  protected undoDiscard(): void {
    void this.state.undoDiscardAsync();
  }

  protected forcePush(offer: GitForcePushOffer): void {
    const dialog = this.dialogs.open(GitForcePushDialogComponent, ".cancel");
    dialog.componentRef?.setInput("offer", offer);
    dialog.componentInstance?.answered.subscribe(isForced => {
      dialog.close();
      if (isForced)
        void this.state.forcePushAsync(offer);
    });
  }

  protected fetch(): void {
    void this.state.fetchAsync();
  }

  protected dismissFailure(): void {
    this.state.failure.set(null);
  }

  protected operationOf(operation: GitOperation, branch: string | null): string {
    return Resources.formatOperation(Resources.operations[operation.kind], GitOperationName.of(operation), branch);
  }

  protected abortOperation(): void {
    void this.state.abortOperationAsync().catch((error: unknown) => this.errors.handleError(error));
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
