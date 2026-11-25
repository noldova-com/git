/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Component, computed, effect, ErrorHandler, inject, input, type InputSignal, output, type OutputEmitterRef, signal, type Signal, untracked, type WritableSignal } from "@angular/core";
import "@noldova/context.core";
import { type IWindowPartContext, LinkPlace, WindowPartTokens } from "@noldova/desktop.window";
import type { GitRemote } from "@noldova/git.protocol";
import { ContextMenuTriggerDirective, MenuComponent, MenuItemComponent, MenuSeparatorComponent } from "@noldova/ui.components.angular";

import { GitPullRequestsState } from "../../enums/git-pull-requests-state.ts";
import type { IGitPullRequests } from "../../interfaces/i-git-pull-requests.ts";
import type { GitPullRequestList } from "../../models/git-pull-request-list.ts";
import type { GitPullRequestRow } from "../../models/git-pull-request-row.ts";
import { GitPullRequests } from "../../services/git-pull-requests.ts";
import { Resources } from "../../../resources.ts";
import { GitReferenceTextComponent } from "../git-reference-text/git-reference-text.component.ts";

/** The repository panel's Pull requests section: the open pull requests of the current branch's remote, from the host that claims it. */
@Component({
  selector: "nol-git-pull-requests",
  imports: [ContextMenuTriggerDirective, GitReferenceTextComponent, MenuComponent, MenuItemComponent, MenuSeparatorComponent],
  templateUrl: "./git-pull-requests.component.html",
  styleUrl: "./git-pull-requests.component.css",
  host: { "(window:focus)": "refresh()" }
})
export class GitPullRequestsComponent {
  private readonly context: IWindowPartContext = inject(WindowPartTokens.context);
  private readonly errors: ErrorHandler = inject(ErrorHandler);

  public readonly folder: InputSignal<string> = input.required<string>();
  public readonly remote: InputSignal<GitRemote> = input.required<GitRemote>();
  /** The current branch, whose own pull request's Switch to branch is off; null with none out. */
  public readonly current: InputSignal<string | null> = input<string | null>(null);
  /** Whether a switch can start now: off while the panel writes or has no status to switch on. */
  public readonly canSwitch: InputSignal<boolean> = input<boolean>(false);
  /** Asks the panel to switch to a pull request's source branch, which git makes from the remote's when it isn't here. */
  public readonly switchTo: OutputEmitterRef<string> = output<string>();

  protected readonly resources: typeof Resources = Resources;
  protected readonly states: typeof GitPullRequestsState = GitPullRequestsState;
  protected readonly isOpen: WritableSignal<boolean> = signal(true);
  /** The remote, kept while each status read gives an equal one, so the host reads again only for another remote. */
  private readonly shown: Signal<GitRemote> = computed(() => this.remote(), {
    equal: (a, b) => a.name === b.name && a.host === b.host && a.path === b.path && a.transport === b.transport
  });
  protected readonly host: Signal<IGitPullRequests | null> = computed(() => GitPullRequests.of(this.shown()));
  /** The claiming host's list; the template reads it only while a host claims the remote. */
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

  /** Asks the host to read the pull requests again: on Try again, and when the window takes the focus. */
  protected refresh(): void {
    const host: IGitPullRequests | null = this.host();
    if (!Object.isNull(host))
      this.attempt(() => host.refresh(this.folder(), this.shown()), undefined);
  }

  protected toggle(): void {
    this.isOpen.update(t => !t);
  }

  /** The status dot's kind: failing checks first, then running ones, then passed ones. */
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

  /** Opens the pull request in the host's own page when it has one, else its page in the browser. */
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

  /** Runs a host's member, reporting what it throws and answering the fallback instead. */
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
