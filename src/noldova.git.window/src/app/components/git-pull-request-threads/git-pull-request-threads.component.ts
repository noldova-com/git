/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { afterNextRender, Component, computed, effect, ElementRef, inject, Injector, input, type InputSignal, output, type OutputEmitterRef, PendingTasks, type Signal,
  signal, untracked, viewChildren, type WritableSignal } from "@angular/core";
import type { JsonValue } from "@noldova/context.json";
import { type IWindowPartContext, RuntimeRequestException, TimeFormatService, WindowException, WindowPartTokens } from "@noldova/desktop.window";
import { HostComment, HostPullRequestThreads, type HostReference, HostThread, ThreadStatus } from "@noldova/git.hosting.protocol";
import { AvatarSize, ButtonComponent, ButtonSize, ButtonVariant, type ILinkReferenceSource, type LinkOpenEvent, SpinnerComponent, TextFieldComponent }
  from "@noldova/ui.components.angular";
import { MarkdownViewComponent } from "@noldova/ui.components.angular/markdown";

import type { IGitPullRequestHost } from "../../interfaces/i-git-pull-request-host.ts";
import { ThreadLine } from "../../models/thread-line.ts";
import { Resources } from "../../../resources.ts";
import { GitPersonAvatarComponent } from "../git-person-avatar/git-person-avatar.component.ts";

@Component({
  selector: "nol-git-pull-request-threads",
  templateUrl: "./git-pull-request-threads.component.html",
  styleUrl: "./git-pull-request-threads.component.css",
  imports: [ButtonComponent, GitPersonAvatarComponent, MarkdownViewComponent, SpinnerComponent, TextFieldComponent]
})
export class GitPullRequestThreadsComponent {
  private readonly context: IWindowPartContext = inject(WindowPartTokens.context);
  private readonly tasks: PendingTasks = inject(PendingTasks);
  private readonly injector: Injector = inject(Injector);
  private readonly attempt: WritableSignal<number> = signal<number>(0);
  private readonly dates: TimeFormatService = inject(TimeFormatService);
  private readonly draftFields: Signal<readonly ElementRef<HTMLTextAreaElement>[]> = viewChildren("draft", { read: ElementRef });
  private generation: number = 0;

  protected readonly resources: typeof Resources = Resources;
  protected readonly secondary: ButtonVariant = ButtonVariant.Secondary;
  protected readonly compact: ButtonSize = ButtonSize.Compact;
  protected readonly small: AvatarSize = AvatarSize.Small;
  protected readonly none: ThreadStatus = ThreadStatus.None;
  protected readonly threads: WritableSignal<readonly HostThread[]> = signal<readonly HostThread[]>([]);
  protected readonly hasMore: WritableSignal<boolean> = signal<boolean>(false);
  protected readonly isRead: WritableSignal<boolean> = signal<boolean>(false);
  protected readonly failure: WritableSignal<string | null> = signal<string | null>(null);
  protected readonly unfolded: WritableSignal<ReadonlySet<number>> = signal<ReadonlySet<number>>(new Set());
  protected readonly drafts: WritableSignal<ReadonlyMap<number, string>> = signal<ReadonlyMap<number, string>>(new Map());
  protected readonly replying: WritableSignal<ReadonlySet<number>> = signal<ReadonlySet<number>>(new Set());
  protected readonly busy: WritableSignal<ReadonlySet<number>> = signal<ReadonlySet<number>>(new Set());
  protected readonly writeFailures: WritableSignal<ReadonlyMap<number, string>> = signal<ReadonlyMap<number, string>>(new Map());
  protected readonly confirming: WritableSignal<number | null> = signal<number | null>(null);
  protected readonly openCount: Signal<number> = computed(() => this.threads().filter(t => Resources.openThreadStates.includes(t.state)).length);

  public readonly host: InputSignal<IGitPullRequestHost> = input.required<IGitPullRequestHost>();

  public readonly reference: InputSignal<HostReference> = input.required<HostReference>();

  public readonly isAutoComplete: InputSignal<boolean> = input<boolean>(false);

  public readonly references: InputSignal<ILinkReferenceSource | null> = input<ILinkReferenceSource | null>(null);

  public readonly linkOpen: OutputEmitterRef<LinkOpenEvent> = output<LinkOpenEvent>();

  public readonly goToLine: OutputEmitterRef<ThreadLine> = output<ThreadLine>();

  public constructor() {
    effect(onCleanup => {
      this.attempt();
      const reference: HostReference = this.reference();
      let isCurrent = true;
      onCleanup(() => {
        isCurrent = false;
      });
      untracked(() => {
        this.generation++;
        this.threads.set([]);
        this.hasMore.set(false);
        this.isRead.set(false);
        this.failure.set(null);
        this.unfolded.set(new Set());
        this.drafts.set(new Map());
        this.replying.set(new Set());
        this.busy.set(new Set());
        this.writeFailures.set(new Map());
        this.confirming.set(null);
        void this.readAsync(reference, () => isCurrent);
      });
    });
  }

  protected retry(): void {
    this.attempt.update(t => t + 1);
  }

  protected isFolded(thread: HostThread): boolean {
    return Resources.doneThreadStates.includes(thread.state) && !this.unfolded().has(thread.id);
  }

  protected isOpen(thread: HostThread): boolean {
    return !Resources.doneThreadStates.includes(thread.state);
  }

  protected lineOf(thread: HostThread, path: string, line: number): ThreadLine {
    return new ThreadLine(thread.id, path, line);
  }

  protected unfold(thread: HostThread): void {
    this.unfolded.update(t => new Set([...t, thread.id]));
  }

  protected dateOf(comment: HostComment): string {
    return this.dates.shortDateTime(comment.publishedAt);
  }

  protected draftOf(thread: HostThread): string {
    return this.drafts().get(thread.id) ?? "";
  }

  protected noteDrafts(): void {
    const drafts: Map<number, string> = new Map(this.drafts());
    for (const field of this.draftFields())
      drafts.set(Number(field.nativeElement.dataset[Resources.threadData]), field.nativeElement.value);
    this.drafts.set(drafts);
  }

  protected isReplying(thread: HostThread): boolean {
    return this.replying().has(thread.id) || this.draftOf(thread).length > 0;
  }

  protected startReply(thread: HostThread): void {
    this.replying.update(t => new Set([...t, thread.id]));
    afterNextRender(() => this.draftFields().find(t => t.nativeElement.dataset[Resources.threadData] === String(thread.id))?.nativeElement.focus(),
      { injector: this.injector });
  }

  protected canReply(thread: HostThread): boolean {
    return !this.busy().has(thread.id) && this.draftOf(thread).trim().length > 0;
  }

  protected async replyAsync(thread: HostThread, method: string): Promise<void> {
    const body: string = this.draftOf(thread);
    const reply: JsonValue = { reference: this.reference().toJson(), thread: thread.id, parent: Math.min(...thread.comments.map(t => t.id)), body };
    await this.writeAsync(thread, method, reply, answer => {
      const comment: HostComment = HostComment.fromJson(answer);
      this.replace(thread.id, t => new HostThread(t.id, t.state, t.path, t.line, [...t.comments, comment]));
      this.drafts.update(t => new Map([...t].filter(([id]) => id !== thread.id)));
      this.replying.update(t => new Set([...t].filter(id => id !== thread.id)));
    });
  }

  protected askChange(thread: HostThread, method: string): void {
    if (this.isAutoComplete() && Resources.openThreadStates.includes(thread.state) && this.openCount() === 1) {
      this.confirming.set(thread.id);
      return;
    }
    void this.changeAsync(thread, method);
  }

  protected confirmChange(thread: HostThread, method: string): void {
    this.confirming.set(null);
    void this.changeAsync(thread, method);
  }

  protected cancelChange(): void {
    this.confirming.set(null);
  }

  private async changeAsync(thread: HostThread, method: string): Promise<void> {
    const state: ThreadStatus = this.isOpen(thread) ? ThreadStatus.Resolved : ThreadStatus.Active;
    await this.writeAsync(thread, method, { reference: this.reference().toJson(), thread: thread.id, state }, () => {
      this.unfold(thread);
      this.replace(thread.id, t => new HostThread(t.id, state, t.path, t.line, t.comments));
    });
  }

  private replace(id: number, change: (thread: HostThread) => HostThread): void {
    this.threads.update(threads => threads.map(t => t.id === id ? change(t) : t));
  }

  private async writeAsync(thread: HostThread, method: string, payload: JsonValue, done: (answer: unknown) => void): Promise<void> {
    const generation: number = this.generation;
    const finished = this.tasks.add();
    this.busy.update(t => new Set([...t, thread.id]));
    this.writeFailures.update(t => new Map([...t].filter(([id]) => id !== thread.id)));
    try {
      const answer = await this.context.requestAsync(method, payload);
      if (generation === this.generation)
        done(answer);
    }
    catch (error) {
      if (!(error instanceof WindowException))
        throw error;
      this.context.log(Resources.formatHostRequestFailed(this.host().name, method, String(error)));
      if (generation === this.generation)
        this.writeFailures.update(t => new Map([...t, [thread.id, error instanceof RuntimeRequestException ? error.message
          : Resources.formatThreadWriteUnanswered(this.host().name)]]));
    }
    finally {
      if (generation === this.generation)
        this.busy.update(t => new Set([...t].filter(id => id !== thread.id)));
      finished();
    }
  }

  private async readAsync(reference: HostReference, isCurrent: () => boolean): Promise<void> {
    const done = this.tasks.add();
    const host: IGitPullRequestHost = this.host();
    try {
      const list: HostPullRequestThreads = HostPullRequestThreads.fromJson(await this.context.requestAsync(host.readThreadsMethod, reference.toJson()));
      if (isCurrent()) {
        this.threads.set(list.threads);
        this.hasMore.set(list.hasMore);
        this.isRead.set(true);
      }
    }
    catch (error) {
      if (!(error instanceof WindowException))
        throw error;
      this.context.log(Resources.formatHostRequestFailed(host.name, host.readThreadsMethod, String(error)));
      if (isCurrent())
        this.failure.set(error instanceof RuntimeRequestException ? error.message : Resources.formatThreadsUnanswered(host.name));
    }
    finally {
      done();
    }
  }
}
