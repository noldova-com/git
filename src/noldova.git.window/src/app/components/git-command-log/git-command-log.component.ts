/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Component, computed, DestroyRef, effect, ErrorHandler, inject, input, type InputSignal, type Signal, signal, untracked, type WritableSignal } from "@angular/core";
import "@noldova/context.core";
import { type IWindowPartContext, WindowPartTokens } from "@noldova/desktop.window";
import type { GitCommand, GitCommandLog } from "@noldova/git.protocol";

import { Resources } from "../../../resources.ts";
import { GitRuntimeClient } from "../../services/git-runtime-client.ts";
import { GitViewStateService } from "../../services/git-view-state.service.ts";

/**
 * The command log: the git commands a repository's writes ran, newest first, read again each time the repository changes. It watches its own
 * repository, wherever its tab is and whichever repository the Git view shows.
 */
@Component({
  selector: "nol-git-command-log",
  templateUrl: "./git-command-log.component.html",
  styleUrl: "./git-command-log.component.css"
})
export class GitCommandLogComponent {
  private readonly context: IWindowPartContext = inject<IWindowPartContext>(WindowPartTokens.context);
  private readonly client: GitRuntimeClient = new GitRuntimeClient(this.context);
  private readonly errors: ErrorHandler = inject(ErrorHandler);
  private reads = 0;

  protected readonly resources: typeof Resources = Resources;
  protected readonly log: WritableSignal<GitCommandLog | null> = signal<GitCommandLog | null>(null);
  protected readonly readFailure: WritableSignal<string | null> = signal<string | null>(null);
  protected readonly commands: Signal<readonly GitCommand[]> = computed(() => [...this.log()?.commands ?? []].reverse());

  /** The repository's folder; the view's instance. */
  public readonly instance: InputSignal<string> = input.required<string>();

  public constructor() {
    effect(onCleanup => {
      const folder: string = this.instance();
      untracked(() => {
        void this.watchAsync(folder);
        void this.readAsync(folder);
      });
      onCleanup(() => void this.unwatchAsync(folder));
    });
    inject(DestroyRef).onDestroy(this.client.onChanged(t => {
      if (t === this.instance())
        void this.readAsync(t);
    }));
  }

  protected timeOf(command: GitCommand): string {
    return new Date(command.at).toLocaleTimeString(Resources.dateLocale);
  }

  protected iconOf(command: GitCommand): string {
    return Object.isNull(command.exitCode) ? Resources.commandStoppedIcon : command.exitCode === 0 ? Resources.commandDoneIcon : Resources.commandFailedIcon;
  }

  protected toneOf(command: GitCommand): string {
    return Object.isNull(command.exitCode) ? "muted" : command.exitCode === 0 ? "ok" : "failure";
  }

  private async watchAsync(folder: string): Promise<void> {
    try {
      await this.client.watchAsync(folder);
    }
    catch (error) {
      this.context.log(Resources.formatCommandLogWatchFailed(folder, GitViewStateService.messageOf(error)));
    }
  }

  private async unwatchAsync(folder: string): Promise<void> {
    try {
      await this.client.unwatchAsync(folder);
    }
    catch (error) {
      this.context.log(Resources.formatCommandLogUnwatchFailed(folder, GitViewStateService.messageOf(error)));
    }
  }

  private async readAsync(folder: string): Promise<void> {
    const read: number = ++this.reads;
    try {
      const log: GitCommandLog = await this.client.commandLogAsync(folder);
      if (read === this.reads) {
        this.log.set(log);
        this.readFailure.set(null);
      }
    }
    catch (error) {
      if (!GitRuntimeClient.isFailure(error))
        this.errors.handleError(error);
      else if (read === this.reads)
        this.readFailure.set(GitViewStateService.messageOf(error));
    }
  }
}
