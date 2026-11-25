/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Component, computed, effect, ElementRef, inject, input, type InputSignal, output, type OutputEmitterRef, PendingTasks, type Signal, signal, untracked,
  viewChildren, type WritableSignal } from "@angular/core";
import "@noldova/context.core";
import { JsonReader, type JsonValue } from "@noldova/context.json";
import { type IWindowPartContext, RuntimeRequestException, WindowException, WindowPartTokens } from "@noldova/desktop.window";
import { AzureDevOpsNames } from "@noldova/git.azure-devops.protocol";
import { type HostChanges, type HostPolicy, type HostPullRequest, PolicyState } from "@noldova/git.hosting.protocol";
import { GitFolderParams, GitNames, GitStatus } from "@noldova/git.protocol";
import { GitFolder } from "@noldova/git.window";
import { ButtonComponent, ButtonVariant, CheckboxComponent, RadioComponent, RadioGroupComponent, SpinnerComponent, TextFieldComponent } from "@noldova/ui.components.angular";

import { Resources } from "../../../resources.ts";
import { CompleteAction } from "../../enums/complete-action.ts";
import { PullRequestClone } from "../../models/pull-request-clone.ts";
import type { MergeTypeChoice } from "../../types/merge-type-choice.ts";
import type { PendingWrite } from "../../types/pending-write.ts";
import type { PullAfter } from "../../types/pull-after.ts";

/**
 * The pull request page's Complete panel: the merge types its policies allow, the merge commit's message and what to do after, with one confirm for
 * each write; the page's footer asks it to set or cancel auto-complete with the same choices.
 */
@Component({
  selector: "nol-git-azure-devops-complete",
  templateUrl: "./azure-devops-complete.component.html",
  styleUrl: "./azure-devops-complete.component.css",
  imports: [ButtonComponent, CheckboxComponent, RadioComponent, RadioGroupComponent, SpinnerComponent, TextFieldComponent]
})
export class AzureDevOpsCompleteComponent {
  private readonly context: IWindowPartContext = inject(WindowPartTokens.context);
  private readonly tasks: PendingTasks = inject(PendingTasks);
  private readonly attempt: WritableSignal<number> = signal<number>(0);
  private readonly key: Signal<string> = computed(() => JSON.stringify(this.pullRequest().item.reference.toJson()));
  private readonly choice: WritableSignal<string | null> = signal<string | null>(null);
  private readonly edited: WritableSignal<string | null> = signal<string | null>(null);
  private readonly fields: Signal<readonly ElementRef<HTMLTextAreaElement>[]> = viewChildren("field", { read: ElementRef });
  private readonly writing: WritableSignal<boolean> = signal<boolean>(false);
  protected readonly resources: typeof Resources = Resources;
  protected readonly secondary: ButtonVariant = ButtonVariant.Secondary;
  protected readonly allowed: WritableSignal<readonly string[] | null> = signal<readonly string[] | null>(null);
  protected readonly typesFailure: WritableSignal<string | null> = signal<string | null>(null);
  protected readonly completeWorkItems: WritableSignal<boolean> = signal<boolean>(true);
  protected readonly deleteSourceBranch: WritableSignal<boolean> = signal<boolean>(true);
  protected readonly clone: WritableSignal<string | null> = signal<string | null>(null);
  protected readonly pullAfter: WritableSignal<boolean> = signal<boolean>(false);
  protected readonly pending: WritableSignal<PendingWrite | null> = signal<PendingWrite | null>(null);
  protected readonly failure: WritableSignal<string | null> = signal<string | null>(null);
  protected readonly mergeType: Signal<MergeTypeChoice | null> = computed(() => {
    const allowed: readonly MergeTypeChoice[] = Resources.mergeTypeChoices.filter(t => (this.allowed() ?? []).includes(t.type));
    return allowed.find(t => t.type === this.choice()) ?? allowed[0] ?? null;
  });
  protected readonly workItemsCompleted: Signal<number> = computed(() => this.completeWorkItems() ? this.pullRequest().workItems.length : 0);
  protected readonly takesMessage: Signal<boolean> = computed(() => this.mergeType()?.type !== Resources.fastForwardMergeType);
  protected readonly message: Signal<string> = computed(() => this.edited() ?? Resources.formatMergeMessage(this.pullRequest().item.reference.number,
    this.pullRequest().item.title, this.pullRequest().workItems.map(t => t.id)));
  protected readonly blocking: Signal<readonly HostPolicy[]> = computed(() => this.pullRequest().policies.filter(t => t.isBlocking && t.state !== PolicyState.Approved));
  protected readonly canComplete: Signal<boolean> = computed(() => this.canAutoComplete() && this.blocking().length === 0);

  /** The open pull request, with its changes, that the panel completes. */
  public readonly pullRequest: InputSignal<HostPullRequest> = input.required<HostPullRequest>();
  /** Its branches and the commit the page showed. */
  public readonly changes: InputSignal<HostChanges> = input.required<HostChanges>();
  /**
   * Emits once Azure DevOps took a write, so the page reads the pull request again: after Complete merge, the folder and branch to pull once it has
   * merged, when the person asked for that; otherwise `null`.
   */
  public readonly changed: OutputEmitterRef<PullAfter | null> = output<PullAfter | null>();
  /** Whether a write runs, so nothing else can be sent. */
  protected readonly isWriting: Signal<boolean> = this.writing.asReadonly();
  /** Whether the choices make a merge Azure DevOps takes, so auto-complete can be set; completing also needs no blocking policy. */
  protected readonly canAutoComplete: Signal<boolean> = computed(() => !Object.isNull(this.mergeType()) && !this.writing()
    && (!this.takesMessage() || (this.message().trim().length > 0 && this.message().length <= Resources.maximumMergeMessageLength)));

  public constructor() {
    effect(onCleanup => {
      this.attempt();
      this.key();
      let isCurrent = true;
      onCleanup(() => {
        isCurrent = false;
      });
      untracked(() => {
        this.allowed.set(null);
        this.typesFailure.set(null);
        this.pending.set(null);
        this.writing.set(false);
        this.failure.set(null);
        void this.readTypesAsync(() => isCurrent);
      });
    });
    effect(onCleanup => {
      this.key();
      const folder: string | null = GitFolder.folder();
      let isCurrent = true;
      onCleanup(() => {
        isCurrent = false;
      });
      untracked(() => {
        this.clone.set(null);
        this.pullAfter.set(false);
        if (!Object.isNull(folder))
          void this.readCloneAsync(folder, () => isCurrent);
      });
    });
  }

  /** Asks once, in the panel, before setting the pull request to complete by itself with the panel's choices. */
  protected askAutoComplete(mergeType: MergeTypeChoice): void {
    this.ask({ action: CompleteAction.SetAutoComplete, mergeType });
  }

  /** Asks once, in the panel, before stopping the pull request from completing by itself. */
  protected askCancelAutoComplete(): void {
    this.ask({ action: CompleteAction.CancelAutoComplete });
  }

  protected noteOf(type: string, allowed: readonly string[]): string | null {
    if (!allowed.includes(type))
      return Resources.notAllowedByPolicy;
    return type === Resources.squashMergeType ? Resources.formatSquashNote(this.changes().baseBranch) : null;
  }

  protected choose(type: string | null): void {
    this.choice.set(type);
    this.pending.set(null);
  }

  protected edit(): void {
    for (const field of this.fields())
      this.edited.set(field.nativeElement.value);
  }

  protected confirmTextOf(pending: PendingWrite): string {
    const { number } = this.pullRequest().item.reference;
    const deleted: string | null = this.deleteSourceBranch() ? this.changes().headBranch : null;
    switch (pending.action) {
      case CompleteAction.Complete:
        return Resources.formatCompleteConfirm(number, pending.mergeType.label, this.changes().baseBranch, deleted, this.workItemsCompleted());
      case CompleteAction.SetAutoComplete:
        return Resources.formatAutoCompleteConfirm(number, pending.mergeType.label, this.changes().baseBranch, deleted, this.workItemsCompleted());
      case CompleteAction.CancelAutoComplete:
        return Resources.formatCancelAutoCompleteConfirm(number);
      case CompleteAction.Abandon:
        return Resources.formatAbandonConfirm(number);
    }
  }

  protected confirmLabelOf(action: CompleteAction): string {
    switch (action) {
      case CompleteAction.Complete:
        return Resources.completeMergeAction;
      case CompleteAction.SetAutoComplete:
        return Resources.setAutoCompleteAction;
      case CompleteAction.CancelAutoComplete:
        return Resources.cancelAutoCompleteAction;
      case CompleteAction.Abandon:
        return Resources.abandonAction;
    }
  }

  protected dismissLabelOf(action: CompleteAction): string {
    return action === CompleteAction.CancelAutoComplete ? Resources.keepAutoCompleteAction : Resources.cancelAction;
  }

  protected retryTypes(): void {
    this.attempt.update(t => t + 1);
  }

  protected askComplete(mergeType: MergeTypeChoice): void {
    this.ask({ action: CompleteAction.Complete, mergeType });
  }

  protected askAbandon(): void {
    this.ask({ action: CompleteAction.Abandon });
  }

  protected cancel(): void {
    this.pending.set(null);
  }

  protected confirm(pending: PendingWrite): void {
    this.pending.set(null);
    const reference: JsonValue = this.pullRequest().item.reference.toJson();
    const sourceCommit: string = this.changes().headCommit;
    switch (pending.action) {
      case CompleteAction.Complete: {
        const clone: string | null = this.clone();
        const pull: PullAfter | null = !Object.isNull(clone) && this.pullAfter() ? { folder: clone, branch: this.changes().baseBranch } : null;
        void this.writeAsync(AzureDevOpsNames.completePullRequestMethod, this.completionOf(reference, sourceCommit, pending.mergeType.type), pull);
        return;
      }
      case CompleteAction.SetAutoComplete:
        void this.writeAsync(AzureDevOpsNames.setAutoCompleteMethod, this.completionOf(reference, sourceCommit, pending.mergeType.type), null);
        return;
      case CompleteAction.CancelAutoComplete:
        void this.writeAsync(AzureDevOpsNames.cancelAutoCompleteMethod, reference, null);
        return;
      case CompleteAction.Abandon:
        void this.writeAsync(AzureDevOpsNames.abandonPullRequestMethod, { reference, sourceCommit }, null);
    }
  }

  private ask(pending: PendingWrite): void {
    this.failure.set(null);
    this.pending.set(pending);
  }

  private completionOf(reference: JsonValue, sourceCommit: string, mergeType: string): JsonValue {
    return { reference, sourceCommit, targetBranch: this.changes().baseBranch, mergeType,
      message: mergeType === Resources.fastForwardMergeType ? null : this.message(), completeWorkItems: this.workItemsCompleted() > 0,
      deleteSourceBranch: this.deleteSourceBranch() };
  }

  private async readTypesAsync(isCurrent: () => boolean): Promise<void> {
    const done = this.tasks.add();
    try {
      const answer = await this.context.requestAsync(AzureDevOpsNames.readMergeTypesMethod, this.pullRequest().item.reference.toJson());
      const types: readonly string[] | null = Object.isNull(answer) ? null : JsonReader.fromValue({ types: answer }).readStringArray("types");
      if (isCurrent()) {
        this.allowed.set(types ?? []);
        this.typesFailure.set(Object.isNull(types) ? Resources.mergeTypesUnanswered : null);
      }
    }
    catch (error) {
      if (!(error instanceof WindowException))
        throw error;
      this.context.log(Resources.formatRequestFailed(AzureDevOpsNames.readMergeTypesMethod, String(error)));
      if (isCurrent())
        this.typesFailure.set(Resources.mergeTypesUnanswered);
    }
    finally {
      done();
    }
  }

  private async readCloneAsync(folder: string, isCurrent: () => boolean): Promise<void> {
    const done = this.tasks.add();
    try {
      const status: GitStatus = GitStatus.fromJson(await this.context.requestAsync(GitNames.statusMethod, new GitFolderParams(folder).toJson()));
      if (isCurrent() && PullRequestClone.isPullTarget(status, this.pullRequest().item.url, this.changes().baseBranch))
        this.clone.set(folder);
    }
    catch (error) {
      if (!(error instanceof WindowException))
        throw error;
      this.context.log(Resources.formatRequestFailed(GitNames.statusMethod, String(error)));
    }
    finally {
      done();
    }
  }

  private async writeAsync(method: string, payload: JsonValue, pull: PullAfter | null): Promise<void> {
    const key: string = this.key();
    const done = this.tasks.add();
    this.writing.set(true);
    this.failure.set(null);
    try {
      await this.context.requestAsync(method, payload);
      if (key === this.key())
        this.changed.emit(pull);
    }
    catch (error) {
      if (!(error instanceof WindowException))
        throw error;
      this.context.log(Resources.formatRequestFailed(method, String(error)));
      if (key === this.key())
        this.failure.set(error instanceof RuntimeRequestException ? error.message : Resources.writeUnanswered);
    }
    finally {
      if (key === this.key())
        this.writing.set(false);
      done();
    }
  }
}
