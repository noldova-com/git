/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Component, computed, effect, ErrorHandler, inject, input, type InputSignal, output, type OutputEmitterRef, signal, type Signal, untracked, type WritableSignal } from "@angular/core";
import "@noldova/context.core";
import { type IWindowPartContext, LinkPlace, TimeFormatService, WindowPartTokens } from "@noldova/desktop.window";
import type { GitRemote } from "@noldova/git.protocol";
import { ContextMenuTriggerDirective, MenuComponent, MenuItemComponent, MenuSeparatorComponent } from "@noldova/ui.components.angular";

import { GitPullRequestsState } from "../../enums/git-pull-requests-state.ts";
import type { IGitPullRequests } from "../../interfaces/i-git-pull-requests.ts";
import type { GitPullRequestList } from "../../models/git-pull-request-list.ts";
import type { GitPullRequestRow } from "../../models/git-pull-request-row.ts";
import { GitPullRequests } from "../../services/git-pull-requests.ts";
import { Resources } from "../../../resources.ts";

@Component({
  selector: "nol-git-pull-requests",
  imports: [ContextMenuTriggerDirective, MenuComponent, MenuItemComponent, MenuSeparatorComponent],
  templateUrl: "./git-pull-requests.component.html",
  styleUrl: "./git-pull-requests.component.css",
  host: { "(window:focus)": "refresh()" }
})
export class GitPullRequestsComponent {
  private readonly context: IWindowPartContext = inject(WindowPartTokens.context);
  private readonly errors: ErrorHandler = inject(ErrorHandler);
  private readonly dates: TimeFormatService = inject(TimeFormatService);

  public readonly folder: InputSignal<string> = input.required<string>();
  public readonly remote: InputSignal<GitRemote> = input.required<GitRemote>();
  public readonly current: InputSignal<string | null> = input<string | null>(null);
  public readonly canSwitch: InputSignal<boolean> = input<boolean>(false);
  public readonly switchTo: OutputEmitterRef<string> = output<string>();

  protected readonly resources: typeof Resources = Resources;
  protected readonly states: typeof GitPullRequestsState = GitPullRequestsState;
  protected readonly isOpen: WritableSignal<boolean> = signal(true);
  private readonly shown: Signal<GitRemote> = computed(() => this.remote(), {
    equal: (a, b) => a.name === b.name && a.host === b.host && a.path === b.path && a.transport === b.transport
  });
  protected readonly host: Signal<IGitPullRequests | null> = computed(() => GitPullRequests.of(this.shown()));
  protected readonly list: Signal<GitPullRequestList | null> = computed(() =>
    this.attempt(() => this.host()?.listFor(this.folder(), this.shown())() ?? null, null));
  protected readonly rows: Signal<readonly GitPullRequestRow[]> = computed(() => (this.list()?.rows ?? []).slice(0, Resources.shownPullRequests));

  public constructor() {
    effect(() => {
      this.host();
      this.folder();
      this.shown();
      untracked(() => this.refresh());
    });
  }

  protected limitedText(hostName: string, until: number): string {
    return Resources.formatRateLimited(hostName, this.dates.dateTime(until));
  }

  protected refresh(): void {
    const host: IGitPullRequests | null = this.host();
    if (!Object.isNull(host))
      this.attempt(() => host.refresh(this.folder(), this.shown()), undefined);
  }

  protected toggle(): void {
    this.isOpen.update(t => !t);
  }

  protected toneOf(row: GitPullRequestRow): string {
    if (row.failing > 0)
      return "failed";
    if (row.pending > 0)
      return "pending";
    return row.passed > 0 ? "ok" : "none";
  }

  protected noteOf(row: GitPullRequestRow): string {
    return Resources.formatPullRequestNote(row.failing, row.pending, row.approvals, row.isDraft);
  }

  protected isShown(row: GitPullRequestRow): boolean {
    const host: IGitPullRequests | null = this.host();
    return !Object.isNull(host) && this.attempt(() => host.isShown?.(this.folder(), row) === true, false);
  }

  protected open(row: GitPullRequestRow): void {
    const host: IGitPullRequests | null = this.host();
    if (!Object.isNull(host) && this.attempt(() => host.open?.(this.folder(), row) === true, false))
      return;
    this.openInBrowser(row);
  }

  protected openInBrowser(row: GitPullRequestRow): void {
    void this.context.openLinkAsync(row.url, { place: LinkPlace.System }).catch((error: unknown) => this.errors.handleError(error));
  }

  protected copyLink(row: GitPullRequestRow): void {
    navigator.clipboard.writeText(row.url).catch((error: unknown) => this.errors.handleError(error));
  }

  protected signIn(page: string): void {
    void this.context.runCommandAsync(Resources.openSettingsCommand, { [Resources.settingsPageArgument]: page }).catch((error: unknown) => this.errors.handleError(error));
  }

  private attempt<T>(run: () => T, fallback: T): T {
    try {
      return run();
    }
    catch (error) {
      this.errors.handleError(error);
      return fallback;
    }
  }
}
