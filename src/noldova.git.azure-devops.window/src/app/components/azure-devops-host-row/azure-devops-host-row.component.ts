/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Component, computed, DestroyRef, effect, inject, input, type InputSignal, type OnInit, PendingTasks, type Signal,
  signal, untracked, type WritableSignal } from "@angular/core";
import { type IWindowPartContext, WindowException, WindowPartTokens } from "@noldova/desktop.window";
import { AzureDevOpsNames } from "@noldova/git.azure-devops.protocol";
import { BranchPullRequest, BranchQuery, CheckState, type HostCheck, HostSignIn, SignInState } from "@noldova/git.hosting.protocol";
import type { GitRemote } from "@noldova/git.protocol";
import { ButtonComponent, ButtonVariant, IconButtonComponent, SpinnerComponent, TooltipDirective } from "@noldova/ui.components.angular";

import { ShownPullRequest } from "../../models/shown-pull-request.ts";
import { WorkItemsPlace } from "../../models/work-items-place.ts";
import { Resources } from "../../../resources.ts";
import { SignInEvents } from "../../services/sign-in-events.ts";

@Component({
  selector: "nol-git-azure-devops-host-row",
  templateUrl: "./azure-devops-host-row.component.html",
  styleUrl: "./azure-devops-host-row.component.css",
  imports: [ButtonComponent, IconButtonComponent, SpinnerComponent, TooltipDirective]
})
export class AzureDevOpsHostRowComponent implements OnInit {
  private static readonly WORST_FIRST: readonly CheckState[] = [CheckState.Failed, CheckState.Running, CheckState.Queued, CheckState.Succeeded,
    CheckState.Neutral];
  private readonly attempt: WritableSignal<number> = signal<number>(0);
  private shownQuery: BranchQuery | null = null;
  private signInEvents: number = 0;
  private readonly context: IWindowPartContext = inject(WindowPartTokens.context);
  private readonly destroyRef: DestroyRef = inject(DestroyRef);
  private readonly tasks: PendingTasks = inject(PendingTasks);
  private readonly query: Signal<BranchQuery | null> = computed(
    () => this.isSignedIn() ? AzureDevOpsHostRowComponent.queryOf(this.remote(), this.branch(), this.head()) : null,
    { equal: AzureDevOpsHostRowComponent.isSameQuery });

  protected readonly resources: typeof Resources = Resources;
  protected readonly secondary: ButtonVariant = ButtonVariant.Secondary;
  protected readonly states: typeof CheckState = CheckState;
  protected readonly signIn: WritableSignal<HostSignIn | null> = signal<HostSignIn | null>(null);
  protected readonly answer: WritableSignal<BranchPullRequest | null> = signal<BranchPullRequest | null>(null);
  protected readonly failure: WritableSignal<string | null> = signal<string | null>(null);
  protected readonly failedLink: WritableSignal<string | null> = signal<string | null>(null);
  protected readonly isReading: WritableSignal<boolean> = signal<boolean>(false);
  protected readonly isSignedIn: Signal<boolean> = computed(() => this.signIn()?.state === SignInState.SignedIn);
  protected readonly shown: Signal<ShownPullRequest | null> = computed(() => {
    const answer: BranchPullRequest | null = this.answer();
    const pullRequest = answer?.pullRequest ?? null;
    return answer === null || pullRequest === null ? null : new ShownPullRequest(pullRequest, [...answer.checks]
      .sort((a, b) => AzureDevOpsHostRowComponent.WORST_FIRST.indexOf(a.state) - AzureDevOpsHostRowComponent.WORST_FIRST.indexOf(b.state)));
  });

  public readonly folder: InputSignal<string> = input.required<string>();
  public readonly branch: InputSignal<string | null> = input.required<string | null>();
  public readonly head: InputSignal<string | null> = input.required<string | null>();
  public readonly remote: InputSignal<GitRemote> = input.required<GitRemote>();
  /** The remote's project, whose work items the row opens; null for a remote that names none. */
  protected readonly place: Signal<WorkItemsPlace | null> = computed(() => WorkItemsPlace.ofRemote(this.remote()));

  public constructor() {
    effect(onCleanup => {
      this.attempt();
      const query: BranchQuery | null = this.query();
      let isCurrent = true;
      onCleanup(() => {
        isCurrent = false;
      });
      untracked(() => {
        if (!AzureDevOpsHostRowComponent.isSameBranch(query, this.shownQuery))
          this.answer.set(null);
        this.shownQuery = query;
        this.isReading.set(query !== null);
        if (query !== null)
          void this.readAsync(query, () => isCurrent);
      });
    });
  }

  public ngOnInit(): void {
    const unfollow = SignInEvents.follow(this.context, signIn => {
      this.signInEvents++;
      this.showSignIn(signIn);
    });
    this.destroyRef.onDestroy(unfollow);
    void this.readSignInAsync();
  }

  protected checkLabelOf(check: HostCheck): string {
    return Resources.checkLabels[check.state];
  }

  protected checkIconOf(check: HostCheck): string {
    return Resources.checkIcons[check.state];
  }

  protected titleOf(shown: ShownPullRequest): string {
    return Resources.formatPullRequestTitle(shown.pullRequest.reference.number, shown.pullRequest.title);
  }

  protected retry(): void {
    this.failure.set(null);
    if (this.signIn() === null)
      void this.readSignInAsync();
    else
      this.attempt.update(t => t + 1);
  }

  /** Opens the remote's project's work items. */
  protected openBoard(place: WorkItemsPlace, document: string, title: string): void {
    this.context.openDocument(document, Resources.formatWorkItemsInstance(place.organization, place.project, null), title);
  }

  protected async openAsync(url: string): Promise<void> {
    const done = this.tasks.add();
    this.failedLink.set(null);
    try {
      await this.context.openLinkAsync(url);
    }
    catch (error) {
      if (!(error instanceof WindowException))
        throw error;
      this.context.log(Resources.formatLinkFailed(url, String(error)));
      this.failedLink.set(url);
    }
    finally {
      done();
    }
  }

  private async readAsync(query: BranchQuery, isCurrent: () => boolean): Promise<void> {
    const done = this.tasks.add();
    this.failure.set(null);
    try {
      const answer = BranchPullRequest.fromJson(await this.context.requestAsync(AzureDevOpsNames.readBranchPullRequestMethod, query.toJson()));
      if (isCurrent())
        this.answer.set(answer);
    }
    catch (error) {
      if (!(error instanceof WindowException))
        throw error;
      this.context.log(Resources.formatRequestFailed(AzureDevOpsNames.readBranchPullRequestMethod, String(error)));
      if (isCurrent())
        this.failure.set(Resources.unanswered);
    }
    finally {
      if (isCurrent())
        this.isReading.set(false);
      done();
    }
  }

  private async readSignInAsync(): Promise<void> {
    const done = this.tasks.add();
    const events: number = this.signInEvents;
    try {
      const answer = HostSignIn.fromJson(await this.context.requestAsync(AzureDevOpsNames.readSignInMethod, null));
      if (this.signInEvents === events)
        this.showSignIn(answer);
    }
    catch (error) {
      if (!(error instanceof WindowException))
        throw error;
      this.context.log(Resources.formatRequestFailed(AzureDevOpsNames.readSignInMethod, String(error)));
      this.failure.set(Resources.hostRowSignInUnanswered);
    }
    finally {
      done();
    }
  }

  private showSignIn(next: HostSignIn): void {
    if (next.state !== this.signIn()?.state) {
      this.failure.set(null);
      this.failedLink.set(null);
    }
    this.signIn.set(next);
  }

  private static queryOf(remote: GitRemote, branch: string | null, head: string | null): BranchQuery | null {
    return branch === null || remote.host === null || remote.path === null ? null : new BranchQuery(remote.host, remote.path, branch, head);
  }

  private static isSameQuery(a: BranchQuery | null, b: BranchQuery | null): boolean {
    return AzureDevOpsHostRowComponent.isSameBranch(a, b) && a?.headCommit === b?.headCommit;
  }

  private static isSameBranch(a: BranchQuery | null, b: BranchQuery | null): boolean {
    return a === null || b === null ? a === b : a.host === b.host && a.path === b.path && a.branch === b.branch;
  }
}
