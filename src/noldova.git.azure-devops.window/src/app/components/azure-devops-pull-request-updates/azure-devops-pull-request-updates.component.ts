/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { NgTemplateOutlet } from "@angular/common";
import { Component, effect, inject, input, type InputSignal, output, type OutputEmitterRef, PendingTasks, signal, untracked, type WritableSignal } from "@angular/core";
import { type IWindowPartContext, WindowException, WindowPartTokens } from "@noldova/desktop.window";
import { AzureDevOpsNames } from "@noldova/git.azure-devops.protocol";
import { type HostPullRequestUpdate, HostPullRequestUpdates, type HostReference } from "@noldova/git.hosting.protocol";
import { GitHistorySelection } from "@noldova/git.window";
import { ButtonComponent, ButtonVariant, SpinnerComponent } from "@noldova/ui.components.angular";

import { AzureDevOpsLocalFolder } from "../../services/azure-devops-local-folder.ts";
import { Resources } from "../../../resources.ts";

@Component({
  selector: "nol-git-azure-devops-pull-request-updates",
  templateUrl: "./azure-devops-pull-request-updates.component.html",
  styleUrl: "./azure-devops-pull-request-updates.component.css",
  imports: [ButtonComponent, NgTemplateOutlet, SpinnerComponent]
})
export class AzureDevOpsPullRequestUpdatesComponent {
  private readonly context: IWindowPartContext = inject(WindowPartTokens.context);
  private readonly tasks: PendingTasks = inject(PendingTasks);
  private readonly attempt: WritableSignal<number> = signal<number>(0);
  private isFirstRead: boolean = true;
  private readonly dates: Intl.DateTimeFormat = new Intl.DateTimeFormat(undefined, Resources.linkedCommitDateFormat);

  protected readonly resources: typeof Resources = Resources;
  protected readonly secondary: ButtonVariant = ButtonVariant.Secondary;
  protected readonly list: WritableSignal<HostPullRequestUpdates | null> = signal<HostPullRequestUpdates | null>(null);
  protected readonly folder: WritableSignal<string | null> = signal<string | null>(null);
  protected readonly failure: WritableSignal<string | null> = signal<string | null>(null);
  protected readonly isReading: WritableSignal<boolean> = signal<boolean>(true);

  public readonly reference: InputSignal<HostReference> = input.required<HostReference>();

  public readonly url: InputSignal<string> = input.required<string>();

  public readonly answer: InputSignal<HostPullRequestUpdates | null> = input<HostPullRequestUpdates | null>(null);

  public readonly counted: OutputEmitterRef<string> = output<string>();

  public constructor() {
    effect(onCleanup => {
      this.attempt();
      const reference: HostReference = this.reference();
      let isCurrent = true;
      onCleanup(() => {
        isCurrent = false;
      });
      untracked(() => {
        this.list.set(null);
        this.folder.set(null);
        this.failure.set(null);
        this.isReading.set(true);
        const given: HostPullRequestUpdates | null = this.isFirstRead ? this.answer() : null;
        this.isFirstRead = false;
        void this.readAsync(reference, given, () => isCurrent);
      });
    });
  }

  protected retry(): void {
    this.attempt.update(t => t + 1);
  }

  protected shortOf(update: HostPullRequestUpdate): string {
    return update.sourceCommit.slice(0, Resources.shortCommitLength);
  }

  protected ageOf(update: HostPullRequestUpdate): string {
    return Resources.formatCommitAge(Date.now() - update.createdAt) ?? this.dates.format(update.createdAt);
  }

  protected open(folder: string, update: HostPullRequestUpdate): void {
    void this.openAsync(folder, update);
  }

  private async openAsync(folder: string, update: HostPullRequestUpdate): Promise<void> {
    try {
      await GitHistorySelection.selectAsync(this.context, folder, update.sourceCommit);
    }
    catch (error) {
      if (!(error instanceof WindowException))
        throw error;
      this.context.log(Resources.formatRequestFailed(Resources.openHistoryCommand, String(error)));
    }
  }

  private async readListAsync(reference: HostReference): Promise<HostPullRequestUpdates> {
    return HostPullRequestUpdates.fromJson(await this.context.requestAsync(AzureDevOpsNames.readPullRequestUpdatesMethod, reference.toJson()));
  }

  private async readAsync(reference: HostReference, given: HostPullRequestUpdates | null, isCurrent: () => boolean): Promise<void> {
    const done = this.tasks.add();
    try {
      const [list, folder] = await Promise.all([given ?? this.readListAsync(reference), AzureDevOpsLocalFolder.readAsync(this.context, this.url())]);
      if (isCurrent()) {
        this.list.set(list);
        this.folder.set(folder);
        this.counted.emit(`${list.updates.length}${list.hasMore ? Resources.moreMark : ""}`);
      }
    }
    catch (error) {
      if (!(error instanceof WindowException))
        throw error;
      this.context.log(Resources.formatRequestFailed(AzureDevOpsNames.readPullRequestUpdatesMethod, String(error)));
      if (isCurrent())
        this.failure.set(Resources.updatesUnanswered);
    }
    finally {
      if (isCurrent())
        this.isReading.set(false);
      done();
    }
  }
}
