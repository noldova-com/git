/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Component, effect, inject, input, type InputSignal, output, type OutputEmitterRef, PendingTasks, signal, untracked, type WritableSignal } from "@angular/core";
import { type IWindowPartContext, WindowException, WindowPartTokens } from "@noldova/desktop.window";
import { type HostPullRequestCommit, HostPullRequestCommits, type HostReference } from "@noldova/git.hosting.protocol";
import { ButtonComponent, ButtonVariant, SpinnerComponent } from "@noldova/ui.components.angular";

import type { IGitPullRequestHost } from "../../interfaces/i-git-pull-request-host.ts";
import { GitHistorySelection } from "../../services/git-history-selection.ts";
import { Resources } from "../../../resources.ts";

@Component({
  selector: "nol-git-pull-request-commits",
  templateUrl: "./git-pull-request-commits.component.html",
  styleUrl: "./git-pull-request-commits.component.css",
  imports: [ButtonComponent, SpinnerComponent]
})
export class GitPullRequestCommitsComponent {
  private readonly context: IWindowPartContext = inject(WindowPartTokens.context);
  private readonly tasks: PendingTasks = inject(PendingTasks);
  private readonly attempt: WritableSignal<number> = signal<number>(0);
  private readonly dates: Intl.DateTimeFormat = new Intl.DateTimeFormat(undefined, Resources.pullRequestCommitDateFormat);

  protected readonly resources: typeof Resources = Resources;
  protected readonly secondary: ButtonVariant = ButtonVariant.Secondary;
  protected readonly list: WritableSignal<HostPullRequestCommits | null> = signal<HostPullRequestCommits | null>(null);
  protected readonly folder: WritableSignal<string | null> = signal<string | null>(null);
  protected readonly failure: WritableSignal<string | null> = signal<string | null>(null);
  protected readonly isReading: WritableSignal<boolean> = signal<boolean>(true);

  /** The host that reads the tab's list and finds the pull request's repository on this computer. */
  public readonly host: InputSignal<IGitPullRequestHost> = input.required<IGitPullRequestHost>();

  /** The pull request whose commits it lists. */
  public readonly reference: InputSignal<HostReference> = input.required<HostReference>();

  /** The pull request's page on its host, from which a commit's page is made when the open repository can't show it. */
  public readonly url: InputSignal<string> = input.required<string>();

  /** The tab's count once read, such as `12` or `250+`. */
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
        void this.readAsync(reference, () => isCurrent);
      });
    });
  }

  protected retry(): void {
    this.attempt.update(t => t + 1);
  }

  protected shortOf(commit: HostPullRequestCommit): string {
    return commit.id.slice(0, Resources.shortIdLength);
  }

  protected ageOf(commit: HostPullRequestCommit): string {
    return Resources.formatPullRequestCommitAge(Date.now() - commit.authoredAt) ?? this.dates.format(commit.authoredAt);
  }

  protected open(commit: HostPullRequestCommit): void {
    void this.openAsync(commit);
  }

  private async openAsync(commit: HostPullRequestCommit): Promise<void> {
    const folder: string | null = this.folder();
    const url: string = this.host().commitPageOf(this.url(), commit.id);
    try {
      if (folder === null)
        await this.context.openLinkAsync(url);
      else
        await GitHistorySelection.selectAsync(this.context, folder, commit.id);
    }
    catch (error) {
      if (!(error instanceof WindowException))
        throw error;
      this.context.log(folder === null ? Resources.formatHostLinkFailed(this.host().name, url, String(error))
        : Resources.formatHostRequestFailed(this.host().name, Resources.openHistoryCommand, String(error)));
    }
  }

  private async readAsync(reference: HostReference, isCurrent: () => boolean): Promise<void> {
    const done = this.tasks.add();
    try {
      const [answer, folder] = await Promise.all([this.context.requestAsync(this.host().readCommitsMethod, reference.toJson()),
        this.host().localFolderAsync(this.url())]);
      const list: HostPullRequestCommits = HostPullRequestCommits.fromJson(answer);
      if (isCurrent()) {
        this.list.set(list);
        this.folder.set(folder);
        this.counted.emit(`${list.commits.length}${list.hasMore ? Resources.pullRequestMoreMark : ""}`);
      }
    }
    catch (error) {
      if (!(error instanceof WindowException))
        throw error;
      this.context.log(Resources.formatHostRequestFailed(this.host().name, this.host().readCommitsMethod, String(error)));
      if (isCurrent())
        this.failure.set(Resources.formatPullRequestCommitsUnanswered(this.host().name));
    }
    finally {
      if (isCurrent())
        this.isReading.set(false);
      done();
    }
  }
}
