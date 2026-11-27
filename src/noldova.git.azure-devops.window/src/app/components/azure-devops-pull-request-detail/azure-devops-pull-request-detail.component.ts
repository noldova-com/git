/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Component, computed, effect, inject, input, type InputSignal, type Signal, signal, untracked, type WritableSignal } from "@angular/core";
import "@noldova/context.core";
import { type IWindowPartContext, WindowException, WindowPartTokens } from "@noldova/desktop.window";
import { type HostBuild, type HostPullRequest, type HostReviewer, PolicyState, ReferenceState } from "@noldova/git.hosting.protocol";
import { AvatarSize, IconButtonComponent } from "@noldova/ui.components.angular";

import type { PullRequestChoice } from "../../models/pull-request-choice.ts";
import { PullRequestSelection } from "../../services/pull-request-selection.ts";
import { Resources } from "../../../resources.ts";
import { AzureDevOpsAddReviewerComponent } from "../azure-devops-add-reviewer/azure-devops-add-reviewer.component.ts";
import { AzureDevOpsCompleteComponent } from "../azure-devops-complete/azure-devops-complete.component.ts";
import { AzureDevOpsPersonAvatarComponent } from "../azure-devops-person-avatar/azure-devops-person-avatar.component.ts";

@Component({
  selector: "nol-git-azure-devops-pull-request-detail",
  templateUrl: "./azure-devops-pull-request-detail.component.html",
  styleUrl: "./azure-devops-pull-request-detail.component.css",
  imports: [AzureDevOpsAddReviewerComponent, AzureDevOpsCompleteComponent, AzureDevOpsPersonAvatarComponent, IconButtonComponent]
})
export class AzureDevOpsPullRequestDetailComponent {
  private static readonly SECOND: number = 1000;
  private static readonly MINUTE: number = 60;
  private readonly context: IWindowPartContext = inject(WindowPartTokens.context);

  protected readonly resources: typeof Resources = Resources;
  protected readonly policyStates: typeof PolicyState = PolicyState;
  protected readonly small: AvatarSize = AvatarSize.Small;
  protected readonly open: ReferenceState = ReferenceState.Open;
  protected readonly choice: Signal<PullRequestChoice | null> = PullRequestSelection.of(this.context).choice;
  private readonly pullRequest: Signal<HostPullRequest | null> = computed(() => this.choice()?.pullRequest ?? null);
  protected readonly isAdding: WritableSignal<boolean> = signal<boolean>(false);

  public readonly instance: InputSignal<string> = input.required<string>();

  public constructor() {
    effect(() => {
      const pullRequest: HostPullRequest | null = this.pullRequest();
      const instance: string = this.instance();
      untracked(() => {
        this.isAdding.set(false);
        this.context.updateView(Resources.pullRequestView, instance,
          { title: Object.isNull(pullRequest) ? Resources.pullRequestLabel : Resources.formatPullRequestViewTitle(pullRequest.item.reference.number) });
      });
    });
  }

  protected voteIconOf(reviewer: HostReviewer): string | null {
    if (reviewer.vote > 0)
      return Resources.approvedVoteIcon;
    if (reviewer.vote < 0)
      return reviewer.vote > -1 ? Resources.waitingVoteIcon : Resources.rejectedVoteIcon;
    return null;
  }

  protected loginsOf(choice: PullRequestChoice): readonly string[] {
    return choice.reviewers.map(t => t.person.login);
  }

  protected add(choice: PullRequestChoice, reviewer: HostReviewer): void {
    this.isAdding.set(false);
    choice.actions.added(reviewer);
  }

  protected policySummaryOf(choice: PullRequestChoice, branch: string): string | null {
    const required = choice.pullRequest.policies.filter(t => t.isBlocking);
    return required.length === 0 ? null
      : Resources.formatPoliciesSummary(required.filter(t => t.state === PolicyState.Approved).length, required.length, branch);
  }

  protected buildTimeOf(choice: PullRequestChoice, build: HostBuild): string | null {
    if (Object.isNull(build.startedAt))
      return null;
    const end: number = build.finishedAt ?? choice.readAt;
    const seconds: number = Math.max(0, Math.floor((end - build.startedAt) / AzureDevOpsPullRequestDetailComponent.SECOND));
    return Resources.formatBuildTime(Math.floor(seconds / AzureDevOpsPullRequestDetailComponent.MINUTE), seconds % AzureDevOpsPullRequestDetailComponent.MINUTE,
      Object.isNull(build.finishedAt));
  }

  protected async openAsync(url: string): Promise<void> {
    try {
      await this.context.openLinkAsync(url);
    }
    catch (error) {
      if (!(error instanceof WindowException))
        throw error;
      this.context.log(Resources.formatLinkFailed(url, String(error)));
    }
  }
}
