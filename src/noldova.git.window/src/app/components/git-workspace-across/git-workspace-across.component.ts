/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Component, computed, ErrorHandler, inject, input, type InputSignal, output, type OutputEmitterRef, signal, type Signal, type WritableSignal } from "@angular/core";
import "@noldova/context.core";
import { WindowPartTokens } from "@noldova/desktop.window";
import { ButtonComponent, ButtonSize, ButtonVariant, DialogService, ToolbarButtonComponent } from "@noldova/ui.components.angular";

import { Resources } from "../../../resources.ts";
import { GitAgentState } from "../../enums/git-agent-state.ts";
import type { GitBulkResult } from "../../models/git-bulk-result.ts";
import type { GitBulkTarget } from "../../models/git-bulk-target.ts";
import type { GitPullRequestRow } from "../../models/git-pull-request-row.ts";
import { GitReferencePart } from "../../models/git-reference-part.ts";
import type { GitPullRequestStack } from "../../models/git-pull-request-stack.ts";
import { GitRowPullRequest } from "../../models/git-row-pull-request.ts";
import type { GitSharedBranch } from "../../models/git-shared-branch.ts";
import { GitWorkspaceOverview } from "../../models/git-workspace-overview.ts";
import type { GitWorkspaceReview } from "../../models/git-workspace-review.ts";
import { GitWorkspaceReviews } from "../../models/git-workspace-reviews.ts";
import type { GitWorkspaceRow } from "../../models/git-workspace-row.ts";
import type { GitWorkspaceRun } from "../../models/git-workspace-run.ts";
import { GitRepositorySummaries } from "../../services/git-repository-summaries.ts";
import { GitRuntimeClient } from "../../services/git-runtime-client.ts";
import { GitWorkspaceBulk } from "../../services/git-workspace-bulk.ts";
import { GitBulkPushDialogComponent } from "../git-bulk-push-dialog/git-bulk-push-dialog.component.ts";
import { GitReferenceTextComponent } from "../git-reference-text/git-reference-text.component.ts";

@Component({
  selector: "nol-git-workspace-across",
  imports: [ButtonComponent, GitReferenceTextComponent, ToolbarButtonComponent],
  templateUrl: "./git-workspace-across.component.html",
  styleUrl: "./git-workspace-across.component.css"
})
export class GitWorkspaceAcrossComponent {
  public readonly rows: InputSignal<readonly GitWorkspaceRow[]> = input.required<readonly GitWorkspaceRow[]>();
  public readonly runs: InputSignal<readonly GitWorkspaceRun[]> = input.required<readonly GitWorkspaceRun[]>();
  public readonly reviews: InputSignal<GitWorkspaceReviews> = input<GitWorkspaceReviews>(new GitWorkspaceReviews([], false));
  public readonly repositoryOpened: OutputEmitterRef<string> = output<string>();
  public readonly pullRequestOpened: OutputEmitterRef<GitRowPullRequest> = output<GitRowPullRequest>();
  public readonly reviewOpened: OutputEmitterRef<GitWorkspaceReview> = output<GitWorkspaceReview>();
  public readonly written: OutputEmitterRef<readonly string[]> = output<readonly string[]>();

  protected readonly resources: typeof Resources = Resources;
  protected readonly around: typeof GitReferencePart.around = GitReferencePart.around;
  protected readonly secondary: ButtonVariant = ButtonVariant.Secondary;
  protected readonly compact: ButtonSize = ButtonSize.Compact;
  protected readonly waitingIcon: string = Resources.agentStateIcons[GitAgentState.WaitingForYou];
  protected readonly fetchNote: string = Resources.formatFetchAllNote(GitRepositorySummaries.AT_ONCE);
  protected readonly shared: Signal<GitSharedBranch | null> = computed(() => GitWorkspaceOverview.sharedBranchOf(this.rows()));
  protected readonly conflicted: Signal<readonly GitWorkspaceRow[]> = computed(() => GitWorkspaceOverview.conflictedOf(this.rows()));
  protected readonly failing: Signal<readonly GitWorkspaceRow[]> = computed(() => GitWorkspaceOverview.failingOf(this.rows()));
  protected readonly stacks: Signal<readonly GitPullRequestStack[]> = computed(() => GitWorkspaceOverview.stacksOf(this.rows()));
  protected readonly behind: Signal<readonly GitWorkspaceRow[]> = computed(() => GitWorkspaceOverview.behindOf(this.rows()));
  protected readonly waiting: Signal<readonly GitWorkspaceRun[]> = computed(() => GitWorkspaceOverview.waitingOf(this.runs()));
  protected readonly working: Signal<readonly GitWorkspaceRun[]> = computed(() => GitWorkspaceOverview.workingOf(this.runs()));
  protected readonly hasNeeds: Signal<boolean> = computed(() => this.waiting().length + this.reviews().rows.length + this.conflicted().length + this.failing().length
    + this.stacks().length + this.behind().length > 0);
  protected readonly isQuiet: Signal<boolean> = computed(() => Object.isNull(this.shared()) && !this.hasNeeds() && this.working().length === 0);
  protected readonly isWriting: WritableSignal<boolean> = signal(false);
  protected readonly result: WritableSignal<readonly string[]> = signal<readonly string[]>([]);

  private readonly errors: ErrorHandler = inject(ErrorHandler);
  private readonly dialogs: DialogService = inject(DialogService);
  private readonly bulk: GitWorkspaceBulk = new GitWorkspaceBulk(new GitRuntimeClient(inject(WindowPartTokens.context)), this.errors);

  protected textOf(shared: GitSharedBranch): string {
    return Resources.formatSharedBranchText(shared.branch, shared.rows.map(t => t.name));
  }

  protected openAll(shared: GitSharedBranch): void {
    for (const row of shared.rows)
      this.repositoryOpened.emit(row.folder);
  }

  protected openFailing(row: GitWorkspaceRow): void {
    const pullRequest: GitPullRequestRow | null = row.pullRequest();
    if (Object.isNull(pullRequest))
      this.repositoryOpened.emit(row.folder);
    else
      this.pullRequestOpened.emit(new GitRowPullRequest(row, pullRequest));
  }

  protected stackText(stack: GitPullRequestStack): string {
    return Resources.formatStack(stack.row.name, stack.pullRequests.map(t => t.label));
  }

  protected openStack(stack: GitPullRequestStack): void {
    this.pullRequestOpened.emit(new GitRowPullRequest(stack.row, stack.bottom));
  }

  protected openRun(run: GitWorkspaceRun): void {
    try {
      run.provider.open(run.folder, run.row);
    }
    catch (error) {
      this.errors.handleError(error);
    }
  }

  protected canPush(shared: GitSharedBranch): boolean {
    return GitWorkspaceOverview.pushTargetsOf(shared).some(t => !Object.isNull(t.upstream));
  }

  protected confirmPush(shared: GitSharedBranch): void {
    const targets: readonly GitBulkTarget[] = GitWorkspaceOverview.pushTargetsOf(shared);
    const dialog = this.dialogs.open(GitBulkPushDialogComponent, ".cancel");
    dialog.componentRef?.setInput("branch", shared.branch);
    dialog.componentRef?.setInput("targets", targets);
    dialog.componentInstance?.answered.subscribe(isConfirmed => {
      dialog.close();
      if (isConfirmed)
        void this.writeAsync(Resources.pushedVerb, targets, () => this.bulk.pushAsync(targets));
    });
  }

  protected pullAsync(): Promise<void> {
    const targets: readonly GitBulkTarget[] = GitWorkspaceOverview.pullTargetsOf(this.behind());
    return this.writeAsync(Resources.pulledVerb, targets, () => this.bulk.pullAsync(targets));
  }

  private async writeAsync(verb: string, targets: readonly GitBulkTarget[], write: () => Promise<GitBulkResult>): Promise<void> {
    this.isWriting.set(true);
    this.result.set([]);
    const result: GitBulkResult = await write();
    this.result.set(GitWorkspaceOverview.resultLinesOf(verb, result));
    this.isWriting.set(false);
    this.written.emit(targets.map(t => t.folder));
  }
}
