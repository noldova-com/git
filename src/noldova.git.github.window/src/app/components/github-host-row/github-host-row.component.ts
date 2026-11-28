/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Component, computed, DestroyRef, effect, ElementRef, inject, input, type InputSignal, type OnInit, PendingTasks, type Signal,
  signal, untracked, type WritableSignal } from "@angular/core";
import "@noldova/context.core";
import { type IWindowPartContext, LinkPlace, WindowException, WindowPartTokens } from "@noldova/desktop.window";
import { GitHubNames } from "@noldova/git.github.protocol";
import { AccountPick, BranchPullRequest, BranchQuery, CheckState, type HostAccountList, type HostCheck, HostSignIn, RepositoryAccount, RepositoryQuery,
  SignInState } from "@noldova/git.hosting.protocol";
import type { GitRemote } from "@noldova/git.protocol";
import { FocusKeeper } from "@noldova/git.window";
import { ButtonComponent, ButtonVariant, ClipboardWriter, IconButtonComponent, MenuComponent, MenuItemComponent, MenuTriggerDirective, SpinnerComponent,
  TooltipDirective } from "@noldova/ui.components.angular";

import { AccountReader } from "../../models/account-reader.ts";
import { FailedLink } from "../../models/failed-link.ts";
import type { GitHubLook } from "../../models/github-look.ts";
import { ShownPullRequest } from "../../models/shown-pull-request.ts";
import { Resources } from "../../../resources.ts";
import { GitHubAccountList } from "../../services/github-account-list.ts";
import { GitHubFolders } from "../../services/github-folders.ts";
import { GitHubLooks } from "../../services/github-looks.ts";
import { SignInEvents } from "../../services/sign-in-events.ts";

@Component({
  selector: "nol-git-github-host-row",
  templateUrl: "./github-host-row.component.html",
  styleUrl: "./github-host-row.component.css",
  imports: [ButtonComponent, IconButtonComponent, MenuComponent, MenuItemComponent, MenuTriggerDirective, SpinnerComponent, TooltipDirective]
})
export class GitHubHostRowComponent implements OnInit {
  private static readonly WORST_FIRST: readonly CheckState[] = [CheckState.Failed, CheckState.Running, CheckState.Queued, CheckState.Succeeded,
    CheckState.Neutral];
  private static readonly CHECK_ICONS: Readonly<Record<CheckState, string>> = {
    [CheckState.Failed]: GitHubHostRowComponent.imageOf(Resources.checkFailedOcticon),
    [CheckState.Running]: GitHubHostRowComponent.imageOf(Resources.checkRunningOcticon),
    [CheckState.Queued]: GitHubHostRowComponent.imageOf(Resources.checkQueuedOcticon),
    [CheckState.Succeeded]: GitHubHostRowComponent.imageOf(Resources.checkSucceededOcticon),
    [CheckState.Neutral]: GitHubHostRowComponent.imageOf(Resources.notPlannedOcticon)
  };
  private readonly attempt: WritableSignal<number> = signal<number>(0);
  private shownQuery: BranchQuery | null = null;
  private signInEvents: number = 0;
  private readonly context: IWindowPartContext = inject(WindowPartTokens.context);
  private readonly clipboard: ClipboardWriter = inject(ClipboardWriter);
  private readonly destroyRef: DestroyRef = inject(DestroyRef);
  private readonly tasks: PendingTasks = inject(PendingTasks);
  private readonly accounts: Signal<HostAccountList | null> = GitHubAccountList.of(this.context);
  private readonly folderRemote: Signal<string> = computed(() => JSON.stringify([this.folder(), this.remote().name]));
  private readonly query: Signal<BranchQuery | null> = computed(
    () => this.isSignedIn() ? GitHubHostRowComponent.queryOf(this.remote(), this.branch(), this.head()) : null,
    { equal: GitHubHostRowComponent.isSameQuery });

  protected readonly resources: typeof Resources = Resources;
  protected readonly secondary: ButtonVariant = ButtonVariant.Secondary;
  protected readonly states: typeof CheckState = CheckState;
  protected readonly mark: string = Resources.formatCssUrl(GitHubLooks.mark);
  protected readonly signIn: WritableSignal<HostSignIn | null> = signal<HostSignIn | null>(null);
  protected readonly answer: WritableSignal<BranchPullRequest | null> = signal<BranchPullRequest | null>(null);
  protected readonly failure: WritableSignal<string | null> = signal<string | null>(null);
  protected readonly failedLink: WritableSignal<FailedLink | null> = signal<FailedLink | null>(null);
  protected readonly isBusy: WritableSignal<boolean> = signal<boolean>(false);
  protected readonly copiedCode: WritableSignal<string | null> = signal<string | null>(null);
  protected readonly isReading: WritableSignal<boolean> = signal<boolean>(false);
  protected readonly reader: WritableSignal<RepositoryAccount | null> = signal<RepositoryAccount | null>(null);
  protected readonly readers: Signal<readonly AccountReader[]> = computed(() => {
    const place: string | null = GitHubAccountList.placeOf(this.remote());
    return (this.accounts()?.accounts ?? []).flatMap(t => Object.isNull(t.signIn.account) || t.place !== place ? [] : [new AccountReader(t.id, t.signIn.account.login)]);
  });
  protected readonly readerQuery: Signal<RepositoryQuery | null> = computed(() => {
    const remote: GitRemote = this.remote();
    return this.readers().length < 2 || Object.isNull(remote.host) || Object.isNull(remote.path) ? null : new RepositoryQuery(remote.host, remote.path);
  }, { equal: (a, b) => a?.host === b?.host && a?.path === b?.path });
  protected readonly shownReader: Signal<AccountReader | null> = computed(() => this.readers().find(t => t.id === this.reader()?.account) ?? null);
  protected readonly isSignedIn: Signal<boolean> = computed(() => this.signIn()?.state === SignInState.SignedIn || this.readers().length > 0);
  protected readonly shown: Signal<ShownPullRequest | null> = computed(() => {
    const answer: BranchPullRequest | null = this.answer();
    const pullRequest = answer?.pullRequest ?? null;
    const look: GitHubLook | null = Object.isNull(pullRequest) ? null : GitHubLooks.of(pullRequest.kind, pullRequest.state);
    return Object.isNull(answer) || Object.isNull(pullRequest) || Object.isNull(look) ? null : new ShownPullRequest(pullRequest, look, [...answer.checks]
      .sort((a, b) => GitHubHostRowComponent.WORST_FIRST.indexOf(a.state) - GitHubHostRowComponent.WORST_FIRST.indexOf(b.state)));
  });

  public readonly folder: InputSignal<string> = input.required<string>();
  public readonly branch: InputSignal<string | null> = input.required<string | null>();
  public readonly head: InputSignal<string | null> = input.required<string | null>();
  public readonly remote: InputSignal<GitRemote> = input.required<GitRemote>();

  public constructor() {
    this.destroyRef.onDestroy(FocusKeeper.keep(inject<ElementRef<HTMLElement>>(ElementRef).nativeElement));
    effect(onCleanup => {
      this.attempt();
      const query: BranchQuery | null = this.query();
      this.folderRemote();
      let isCurrent = true;
      onCleanup(() => {
        isCurrent = false;
      });
      untracked(() => {
        if (!GitHubHostRowComponent.isSameBranch(query, this.shownQuery))
          this.answer.set(null);
        this.shownQuery = query;
        this.isReading.set(!Object.isNull(query));
        if (!Object.isNull(query))
          void this.readAsync(this.folder(), this.remote(), query, () => isCurrent);
      });
    });
    effect(onCleanup => {
      this.readers();
      const query: RepositoryQuery | null = this.readerQuery();
      this.folderRemote();
      let isCurrent = true;
      onCleanup(() => {
        isCurrent = false;
      });
      untracked(() => {
        if (Object.isNull(query))
          this.reader.set(null);
        else
          void this.readReaderAsync(this.folder(), this.remote(), query, () => isCurrent);
      });
    });
  }

  public ngOnInit(): void {
    const unfollow = SignInEvents.follow(this.context, signIn => {
      this.signInEvents++;
      this.showSignIn(signIn);
    });
    this.destroyRef.onDestroy(unfollow);
    void this.askAsync(GitHubNames.readSignInMethod);
  }

  protected colorOf(look: GitHubLook): string {
    return Resources.formatLightDark(look.light.color, look.dark.color);
  }

  protected iconOf(look: GitHubLook): string {
    return Resources.formatCssUrl(look.icon);
  }

  protected checkIconOf(check: HostCheck): string {
    return Resources.formatCssUrl(GitHubHostRowComponent.CHECK_ICONS[check.state]);
  }

  protected checkLabelOf(check: HostCheck): string {
    return Resources.checkLabels[check.state];
  }

  protected titleOf(shown: ShownPullRequest): string {
    return Resources.formatPullRequestTitle(shown.pullRequest.reference.number, shown.pullRequest.title);
  }

  protected retry(): void {
    this.failure.set(null);
    if (Object.isNull(this.signIn()))
      void this.askAsync(GitHubNames.readSignInMethod);
    else
      this.attempt.update(t => t + 1);
  }

  protected async startAsync(): Promise<void> {
    const answer = await this.askAsync(GitHubNames.startSignInMethod);
    const code = answer?.deviceCode ?? null;
    if (!Object.isNull(code)) {
      await this.copyAsync(code.userCode);
      await this.openAsync(code.verificationUri, LinkPlace.System);
    }
  }

  protected async cancelAsync(): Promise<void> {
    await this.askAsync(GitHubNames.cancelSignInMethod);
  }

  protected async copyAsync(userCode: string): Promise<void> {
    const done = this.tasks.add();
    try {
      this.copiedCode.set(await this.clipboard.writeTextAsync(userCode) ? userCode : null);
    }
    finally {
      done();
    }
  }

  protected async openAsync(url: string, place: LinkPlace | null = null): Promise<void> {
    const done = this.tasks.add();
    this.failedLink.set(null);
    try {
      await (Object.isNull(place) ? this.context.openLinkAsync(url) : this.context.openLinkAsync(url, { place }));
    }
    catch (error) {
      if (!(error instanceof WindowException))
        throw error;
      this.context.log(Resources.formatLinkFailed(url, String(error)));
      this.failedLink.set(new FailedLink(url, place));
    }
    finally {
      done();
    }
  }

  protected async pickAsync(query: RepositoryQuery, account: number): Promise<void> {
    const done = this.tasks.add();
    this.isBusy.set(true);
    try {
      const answer = RepositoryAccount.fromJson(await this.context.requestAsync(GitHubNames.pickAccountMethod, new AccountPick(query.host, query.path, account).toJson()));
      if (this.readerQuery() === query)
        this.showReader(answer);
    }
    catch (error) {
      if (!(error instanceof WindowException))
        throw error;
      this.context.log(Resources.formatRequestFailed(GitHubNames.pickAccountMethod, String(error)));
      if (this.readerQuery() === query)
        this.failure.set(Resources.accountNotSwitched);
    }
    finally {
      this.isBusy.set(false);
      done();
    }
  }

  private async readReaderAsync(folder: string, remote: GitRemote, query: RepositoryQuery, isCurrent: () => boolean): Promise<void> {
    const done = this.tasks.add();
    try {
      await GitHubFolders.useAsync(this.context, folder, remote);
      if (!isCurrent())
        return;
      const answer = RepositoryAccount.fromJson(await this.context.requestAsync(GitHubNames.readRepositoryAccountMethod, query.toJson()));
      if (isCurrent())
        this.showReader(answer);
    }
    catch (error) {
      if (!(error instanceof WindowException))
        throw error;
      this.context.log(Resources.formatRequestFailed(GitHubNames.readRepositoryAccountMethod, String(error)));
    }
    finally {
      done();
    }
  }

  private showReader(answer: RepositoryAccount): void {
    const shown: number | null = this.reader()?.account ?? null;
    this.reader.set(answer);
    if (!Object.isNull(shown) && shown !== answer.account)
      this.attempt.update(t => t + 1);
  }

  private async readAsync(folder: string, remote: GitRemote, query: BranchQuery, isCurrent: () => boolean): Promise<void> {
    const done = this.tasks.add();
    this.failure.set(null);
    try {
      await GitHubFolders.useAsync(this.context, folder, remote);
      if (!isCurrent())
        return;
      const answer = BranchPullRequest.fromJson(await this.context.requestAsync(GitHubNames.readBranchPullRequestMethod, query.toJson()));
      if (isCurrent())
        this.answer.set(answer);
    }
    catch (error) {
      if (!(error instanceof WindowException))
        throw error;
      this.context.log(Resources.formatRequestFailed(GitHubNames.readBranchPullRequestMethod, String(error)));
      if (isCurrent())
        this.failure.set(Resources.unanswered);
    }
    finally {
      if (isCurrent())
        this.isReading.set(false);
      done();
    }
  }

  private async askAsync(method: string): Promise<HostSignIn | null> {
    const done = this.tasks.add();
    const events: number = this.signInEvents;
    this.isBusy.set(true);
    try {
      const answer = HostSignIn.fromJson(await this.context.requestAsync(method, null));
      if (this.signInEvents === events)
        this.showSignIn(answer);
      return answer;
    }
    catch (error) {
      if (!(error instanceof WindowException))
        throw error;
      this.context.log(Resources.formatRequestFailed(method, String(error)));
      this.failure.set(Resources.hostRowSignInUnanswered);
      return null;
    }
    finally {
      this.isBusy.set(false);
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
    return Object.isNull(branch) || Object.isNull(remote.host) || Object.isNull(remote.path) ? null : new BranchQuery(remote.host, remote.path, branch, head);
  }

  private static isSameQuery(a: BranchQuery | null, b: BranchQuery | null): boolean {
    return GitHubHostRowComponent.isSameBranch(a, b) && a?.headCommit === b?.headCommit;
  }

  private static isSameBranch(a: BranchQuery | null, b: BranchQuery | null): boolean {
    return Object.isNull(a) || Object.isNull(b) ? a === b : a.host === b.host && a.path === b.path && a.branch === b.branch;
  }

  private static imageOf(svg: string): string {
    return Resources.svgImagePrefix + encodeURIComponent(svg);
  }
}
