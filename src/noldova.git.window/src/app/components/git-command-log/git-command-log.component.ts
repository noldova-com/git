/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { afterNextRender, Component, computed, DestroyRef, effect, ElementRef, ErrorHandler, inject, Injector, input, type InputSignal, type Signal, signal, untracked, viewChild,
  type WritableSignal } from "@angular/core";
import "@noldova/context.core";
import { type IWindowPartContext, TimeFormatService, WindowPartTokens } from "@noldova/desktop.window";
import type { GitCommand, GitCommandLog } from "@noldova/git.protocol";

import { Resources } from "../../../resources.ts";
import { GitRuntimeClient } from "../../services/git-runtime-client.ts";
import { GitViewStateService } from "../../services/git-view-state.service.ts";

@Component({
  selector: "nol-git-command-log",
  templateUrl: "./git-command-log.component.html",
  styleUrl: "./git-command-log.component.css"
})
export class GitCommandLogComponent {
  private readonly context: IWindowPartContext = inject<IWindowPartContext>(WindowPartTokens.context);
  private readonly client: GitRuntimeClient = new GitRuntimeClient(this.context);
  private readonly errors: ErrorHandler = inject(ErrorHandler);
  private readonly injector: Injector = inject(Injector);
  private readonly times: TimeFormatService = inject(TimeFormatService);
  private readonly list: Signal<ElementRef<HTMLElement> | undefined> = viewChild<ElementRef<HTMLElement>>("list");
  private reads = 0;
  private height = 0;

  protected readonly resources: typeof Resources = Resources;
  protected readonly log: WritableSignal<GitCommandLog | null> = signal<GitCommandLog | null>(null);
  protected readonly readFailure: WritableSignal<string | null> = signal<string | null>(null);
  protected readonly commands: Signal<readonly GitCommand[]> = computed(() => this.log()?.commands ?? []);

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
    effect(() => {
      this.commands();
      untracked(() => {
        const list: HTMLElement | undefined = this.list()?.nativeElement;
        const atEnd: boolean = Object.isUndefined(list) || GitCommandLogComponent.endsIn(list, list.clientHeight);
        afterNextRender(() => this.keepEnd(atEnd), { injector: this.injector });
      });
    });
    effect(onCleanup => {
      const list: HTMLElement | undefined = this.list()?.nativeElement;
      if (Object.isUndefined(list))
        return;
      this.height = list.clientHeight;
      const observer: ResizeObserver = new ResizeObserver(() => this.keepEnd(GitCommandLogComponent.endsIn(list, this.height)));
      observer.observe(list);
      onCleanup(() => observer.disconnect());
    });
    inject(DestroyRef).onDestroy(this.client.onChanged(t => {
      if (t === this.instance())
        void this.readAsync(t);
    }));
  }

  protected timeOf(command: GitCommand): string {
    return this.times.time(command.at);
  }

  protected iconOf(command: GitCommand): string {
    return Object.isNull(command.exitCode) ? Resources.commandStoppedIcon : command.exitCode === 0 ? Resources.commandDoneIcon : Resources.commandFailedIcon;
  }

  protected toneOf(command: GitCommand): string {
    return Object.isNull(command.exitCode) ? "muted" : command.exitCode === 0 ? "ok" : "failure";
  }

  private static endsIn(list: HTMLElement, height: number): boolean {
    return list.scrollTop + height >= list.scrollHeight - Resources.commandLogEndSlack;
  }

  private keepEnd(atEnd: boolean): void {
    const list: HTMLElement | undefined = this.list()?.nativeElement;
    if (Object.isUndefined(list))
      return;
    if (atEnd)
      list.scrollTop = list.scrollHeight;
    this.height = list.clientHeight;
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
