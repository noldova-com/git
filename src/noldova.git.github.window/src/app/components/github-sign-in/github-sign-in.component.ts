/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { NgTemplateOutlet } from "@angular/common";
import { Component, DestroyRef, effect, ElementRef, inject, type OnInit, PendingTasks, signal, type WritableSignal } from "@angular/core";
import "@noldova/context.core";
import { type IWindowPartContext, LinkPlace, WindowException, WindowPartTokens } from "@noldova/desktop.window";
import { GitHubNames } from "@noldova/git.github.protocol";
import { type DeviceCode, type HostAccount, HostSignIn, SignInState } from "@noldova/git.hosting.protocol";
import { FocusKeeper } from "@noldova/git.window";
import { AvatarComponent, ButtonComponent, ButtonVariant, ClipboardWriter, SpinnerComponent } from "@noldova/ui.components.angular";

import { SignInNotice } from "../../models/sign-in-notice.ts";
import { Resources } from "../../../resources.ts";
import { SignInEvents } from "../../services/sign-in-events.ts";

@Component({
  selector: "nol-git-github-sign-in",
  templateUrl: "./github-sign-in.component.html",
  styleUrl: "./github-sign-in.component.css",
  imports: [AvatarComponent, ButtonComponent, NgTemplateOutlet, SpinnerComponent]
})
export class GitHubSignInComponent implements OnInit {
  private readonly now: WritableSignal<number> = signal<number>(Date.now());
  private readonly context: IWindowPartContext = inject(WindowPartTokens.context);
  private readonly clipboard: ClipboardWriter = inject(ClipboardWriter);
  private readonly destroyRef: DestroyRef = inject(DestroyRef);
  private readonly tasks: PendingTasks = inject(PendingTasks);
  private signInEvents: number = 0;

  protected readonly resources: typeof Resources = Resources;
  protected readonly secondary: ButtonVariant = ButtonVariant.Secondary;
  protected readonly signIn: WritableSignal<HostSignIn | null> = signal<HostSignIn | null>(null);
  protected readonly isBusy: WritableSignal<boolean> = signal<boolean>(false);
  protected readonly copiedCode: WritableSignal<string | null> = signal<string | null>(null);
  protected readonly failure: WritableSignal<string | null> = signal<string | null>(null);

  public constructor() {
    this.destroyRef.onDestroy(FocusKeeper.keep(inject<ElementRef<HTMLElement>>(ElementRef).nativeElement));
    effect(onCleanup => {
      if (this.signIn()?.state !== SignInState.Waiting)
        return;
      this.now.set(Date.now());
      const timer = setInterval(() => this.now.set(Date.now()), Resources.secondMilliseconds);
      onCleanup(() => clearInterval(timer));
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

  protected failureOf(signIn: HostSignIn): SignInNotice | null {
    return Object.isNull(signIn.failure) ? null : new SignInNotice(Resources.failureTitles[signIn.failure], Resources.failureHints[signIn.failure]);
  }

  protected initialOf(account: HostAccount): string {
    return account.login.charAt(0).toUpperCase();
  }

  protected accessOf(account: HostAccount): string {
    return Resources.formatAccess(account.scopes);
  }

  protected remainingOf(code: DeviceCode): string {
    return Resources.formatWaiting(Math.max(0, Math.ceil((code.expiresAt - this.now()) / Resources.secondMilliseconds)));
  }

  protected async startAsync(): Promise<void> {
    const done = this.tasks.add();
    try {
      const answer = await this.askAsync(GitHubNames.startSignInMethod);
      const code = answer?.deviceCode ?? null;
      if (!Object.isNull(code))
        await this.continueAsync(code);
    }
    finally {
      done();
    }
  }

  protected async continueAsync(code: DeviceCode): Promise<void> {
    await this.copyAsync(code.userCode);
    await this.openAsync(code.verificationUri);
  }

  protected async readAsync(): Promise<void> {
    await this.askAsync(GitHubNames.readSignInMethod);
  }

  protected async cancelAsync(): Promise<void> {
    await this.askAsync(GitHubNames.cancelSignInMethod);
  }

  protected async signOutAsync(): Promise<void> {
    await this.askAsync(GitHubNames.signOutMethod);
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

  protected async openAsync(url: string): Promise<void> {
    const done = this.tasks.add();
    try {
      await this.context.openLinkAsync(url, { place: LinkPlace.System });
    }
    catch (error) {
      if (!(error instanceof WindowException))
        throw error;
      this.fail(Resources.linkNotOpened, Resources.formatLinkFailed(url, String(error)));
    }
    finally {
      done();
    }
  }

  protected async manageAsync(): Promise<void> {
    await this.openAsync(GitHubNames.manageAccessUrl);
  }

  private async askAsync(method: string): Promise<HostSignIn | null> {
    const done = this.tasks.add();
    const events: number = this.signInEvents;
    this.isBusy.set(true);
    this.failure.set(null);
    try {
      const answer = HostSignIn.fromJson(await this.context.requestAsync(method, null));
      if (this.signInEvents === events)
        this.signIn.set(answer);
      return answer;
    }
    catch (error) {
      if (!(error instanceof WindowException))
        throw error;
      this.context.log(Resources.formatRequestFailed(method, String(error)));
      if (this.signInEvents === events)
        this.failure.set(Resources.signInUnanswered);
      return null;
    }
    finally {
      this.isBusy.set(false);
      done();
    }
  }

  private showSignIn(next: HostSignIn): void {
    if (next.state !== this.signIn()?.state)
      this.failure.set(null);
    this.signIn.set(next);
  }

  private fail(shown: string, logged: string): void {
    this.context.log(logged);
    this.failure.set(shown);
  }
}
