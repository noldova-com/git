/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Component, effect, inject, input, type InputSignal, output, type OutputEmitterRef, PendingTasks, signal, untracked, type WritableSignal } from "@angular/core";
import "@noldova/context.core";
import { type IWindowPartContext, WindowException, WindowPartTokens } from "@noldova/desktop.window";
import { type HostChanges, HostPullRequestConflicts, type HostReference } from "@noldova/git.hosting.protocol";
import { GitFolderParams, GitNames, GitStatus, OperationKind } from "@noldova/git.protocol";
import { ButtonComponent, ButtonVariant, SpinnerComponent } from "@noldova/ui.components.angular";

import type { IGitPullRequestHost } from "../../interfaces/i-git-pull-request-host.ts";
import { GitFolder } from "../../services/git-folder.ts";
import { Resources } from "../../../resources.ts";

@Component({
  selector: "nol-git-pull-request-conflicts",
  templateUrl: "./git-pull-request-conflicts.component.html",
  styleUrl: "./git-pull-request-conflicts.component.css",
  imports: [ButtonComponent, SpinnerComponent]
})
export class GitPullRequestConflictsComponent {
  private readonly context: IWindowPartContext = inject(WindowPartTokens.context);
  private readonly tasks: PendingTasks = inject(PendingTasks);
  private readonly attempt: WritableSignal<number> = signal<number>(0);

  protected readonly resources: typeof Resources = Resources;
  protected readonly secondary: ButtonVariant = ButtonVariant.Secondary;
  protected readonly list: WritableSignal<HostPullRequestConflicts | null> = signal<HostPullRequestConflicts | null>(null);
  protected readonly folder: WritableSignal<string | null> = signal<string | null>(null);
  protected readonly failure: WritableSignal<string | null> = signal<string | null>(null);
  protected readonly isReading: WritableSignal<boolean> = signal<boolean>(true);

  public readonly host: InputSignal<IGitPullRequestHost> = input.required<IGitPullRequestHost>();

  public readonly reference: InputSignal<HostReference> = input.required<HostReference>();

  public readonly url: InputSignal<string> = input.required<string>();

  public readonly changes: InputSignal<HostChanges | null> = input.required<HostChanges | null>();

  public readonly counted: OutputEmitterRef<string> = output<string>();

  public constructor() {
    effect(onCleanup => {
      this.attempt();
      GitFolder.folder();
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
        void this.readAsync(reference, () => isCurrent);
      });
    });
  }

  protected retry(): void {
    this.attempt.update(t => t + 1);
  }

  protected open(folder: string): void {
    void this.openAsync(folder);
  }

  private async openAsync(folder: string): Promise<void> {
    try {
      await this.context.runCommandAsync(Resources.openConflictsCommand, new GitFolderParams(folder).toJson());
    }
    catch (error) {
      if (!(error instanceof WindowException))
        throw error;
      this.context.log(Resources.formatHostRequestFailed(this.host().name, Resources.openConflictsCommand, String(error)));
    }
  }

  private async readAsync(reference: HostReference, isCurrent: () => boolean): Promise<void> {
    const done = this.tasks.add();
    try {
      const [answer, folder] = await Promise.all([this.context.requestAsync(this.host().readConflictsMethod, reference.toJson()),
        this.host().localFolderAsync(this.url())]);
      const list: HostPullRequestConflicts = HostPullRequestConflicts.fromJson(answer);
      const merging: string | null = Object.isNull(folder) || list.paths.length === 0 ? null : await this.mergingFolderAsync(folder);
      if (!isCurrent())
        return;
      this.list.set(list);
      this.folder.set(merging);
      this.counted.emit(`${list.paths.length}${list.hasMore ? Resources.pullRequestMoreMark : ""}`);
    }
    catch (error) {
      if (!(error instanceof WindowException))
        throw error;
      this.context.log(Resources.formatHostRequestFailed(this.host().name, this.host().readConflictsMethod, String(error)));
      if (isCurrent())
        this.failure.set(Resources.formatPullRequestConflictsUnanswered(this.host().name));
    }
    finally {
      if (isCurrent())
        this.isReading.set(false);
      done();
    }
  }

  private async mergingFolderAsync(folder: string): Promise<string | null> {
    const changes: HostChanges | null = this.changes();
    try {
      const status: GitStatus = GitStatus.fromJson(await this.context.requestAsync(GitNames.statusMethod, new GitFolderParams(folder).toJson()));
      const isMerging: boolean = status.operation?.kind === OperationKind.Merge && !Object.isNull(status.branch)
        && [changes?.headBranch, changes?.baseBranch].includes(status.branch);
      return isMerging ? folder : null;
    }
    catch (error) {
      if (!(error instanceof WindowException))
        throw error;
      this.context.log(Resources.formatHostRequestFailed(this.host().name, GitNames.statusMethod, String(error)));
      return null;
    }
  }
}
