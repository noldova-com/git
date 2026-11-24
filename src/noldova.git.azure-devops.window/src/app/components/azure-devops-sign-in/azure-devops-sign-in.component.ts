/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { NgTemplateOutlet } from "@angular/common";
import { Component, computed, DestroyRef, ElementRef, inject, type OnInit, PendingTasks, signal, type Signal, viewChild, type WritableSignal } from "@angular/core";
import type { JsonValue } from "@noldova/context.json";
import { type IWindowPartContext, LinkPlace, WindowException, WindowPartTokens } from "@noldova/desktop.window";
import { AzureDevOpsNames } from "@noldova/git.azure-devops.protocol";
import { type HostAccount, HostSignIn } from "@noldova/git.hosting.protocol";
import { GitFolderParams, GitNames, GitStatus } from "@noldova/git.protocol";
import { GitFolder } from "@noldova/git.window";
import { AvatarComponent, ButtonComponent, ButtonVariant, SpinnerComponent, TextFieldComponent } from "@noldova/ui.components.angular";

import { SignInNotice } from "../../models/sign-in-notice.ts";
import { Resources } from "../../../resources.ts";
import { AzureDevOpsReferenceLinks } from "../../services/azure-devops-reference-links.ts";
import { SignInEvents } from "../../services/sign-in-events.ts";

@Component({
  selector: "nol-git-azure-devops-sign-in",
  templateUrl: "./azure-devops-sign-in.component.html",
  styleUrl: "./azure-devops-sign-in.component.css",
  imports: [AvatarComponent, ButtonComponent, NgTemplateOutlet, SpinnerComponent, TextFieldComponent]
})
export class AzureDevOpsSignInComponent implements OnInit {
  private readonly context: IWindowPartContext = inject(WindowPartTokens.context);
  private readonly destroyRef: DestroyRef = inject(DestroyRef);
  private readonly tasks: PendingTasks = inject(PendingTasks);
  private readonly tokenField: Signal<ElementRef<HTMLInputElement>> = viewChild.required("tokenField", { read: ElementRef });
  private readonly organizationField: Signal<ElementRef<HTMLInputElement>> = viewChild.required("organizationField", { read: ElementRef });
  private signInEvents: number = 0;
  private readonly visualStudioHome: WritableSignal<string | null> = signal<string | null>(null);
  private readonly organization: Signal<string> = computed(() => AzureDevOpsReferenceLinks.organizationIn(this.organizationText()) ?? String.empty);

  protected readonly resources: typeof Resources = Resources;
  protected readonly secondary: ButtonVariant = ButtonVariant.Secondary;
  protected readonly signIn: WritableSignal<HostSignIn | null> = signal<HostSignIn | null>(null);
  protected readonly isBusy: WritableSignal<boolean> = signal<boolean>(false);
  protected readonly hasToken: WritableSignal<boolean> = signal<boolean>(false);
  protected readonly failure: WritableSignal<string | null> = signal<string | null>(null);
  protected readonly organizationText: WritableSignal<string> = signal<string>("");
  protected readonly hasOrganization: Signal<boolean> = computed(() => this.organization() !== String.empty);
  protected readonly isOrganizationUnread: Signal<boolean> = computed(() => !this.hasOrganization() && this.organizationText().trim() !== String.empty);
  protected readonly tokensUrl: Signal<string | null> = computed(() => this.hasOrganization() ? this.tokensUrlOf(this.organization()) : null);

  public ngOnInit(): void {
    const unfollow = SignInEvents.follow(this.context, signIn => {
      this.signInEvents++;
      this.showSignIn(signIn);
    });
    this.destroyRef.onDestroy(unfollow);
    void this.askAsync(AzureDevOpsNames.readSignInMethod, null);
    const folder = GitFolder.folder();
    if (folder !== null)
      void this.readRemoteAsync(folder);
  }

  protected failureOf(signIn: HostSignIn): SignInNotice | null {
    return signIn.failure === null ? null : new SignInNotice(Resources.failureTitles[signIn.failure], Resources.failureHints[signIn.failure]);
  }

  protected nameOf(account: HostAccount): string {
    return account.name ?? account.login;
  }

  protected signedInOf(account: HostAccount): string {
    return Resources.formatSignedIn(account.name);
  }

  protected noteOrganization(): void {
    this.organizationText.set(this.organizationField().nativeElement.value);
  }

  protected noteToken(): void {
    this.hasToken.set(this.tokenField().nativeElement.value.trim() !== "");
  }

  protected async startAsync(): Promise<void> {
    const address = (await this.askAsync(AzureDevOpsNames.startSignInMethod, { organization: this.organization() }))?.address ?? null;
    if (address !== null)
      await this.openAsync(address);
  }

  protected async cancelAsync(): Promise<void> {
    await this.askAsync(AzureDevOpsNames.cancelSignInMethod, null);
  }

  protected async signInAsync(): Promise<void> {
    const field = this.tokenField().nativeElement;
    const token = field.value.trim();
    if (token === "" || !this.hasOrganization())
      return;
    const done = this.tasks.add();
    try {
      await this.askAsync(AzureDevOpsNames.signInWithTokenMethod, { token, organization: this.organization() });
    }
    finally {
      field.value = "";
      this.hasToken.set(false);
      done();
    }
  }

  protected async readAsync(): Promise<void> {
    await this.askAsync(AzureDevOpsNames.readSignInMethod, null);
  }

  protected async signOutAsync(): Promise<void> {
    await this.askAsync(AzureDevOpsNames.signOutMethod, null);
  }

  protected async openAsync(url: string): Promise<void> {
    const done = this.tasks.add();
    try {
      await this.context.openLinkAsync(url, { place: LinkPlace.System });
    }
    catch (error) {
      if (!(error instanceof WindowException))
        throw error;
      this.context.log(Resources.formatLinkFailed(url, String(error)));
      this.failure.set(Resources.linkNotOpened);
    }
    finally {
      done();
    }
  }

  private async askAsync(method: string, parameters: JsonValue): Promise<HostSignIn | null> {
    const done = this.tasks.add();
    const events: number = this.signInEvents;
    this.isBusy.set(true);
    this.failure.set(null);
    try {
      const answer = HostSignIn.fromJson(await this.context.requestAsync(method, parameters));
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

  private tokensUrlOf(organization: string): string {
    return Resources.formatTokensUrl(organization, this.visualStudioHome()?.toLowerCase() === organization.toLowerCase()
      || this.organizationText().toLowerCase().includes(Resources.visualStudioSuffix));
  }

  private async readRemoteAsync(folder: string): Promise<void> {
    const done = this.tasks.add();
    try {
      const remote = GitStatus.fromJson(await this.context.requestAsync(GitNames.statusMethod, new GitFolderParams(folder).toJson())).remote;
      const organization = AzureDevOpsReferenceLinks.homeOf(remote);
      if (organization === null || remote === null || this.organizationText().trim() !== String.empty)
        return;
      this.visualStudioHome.set(AzureDevOpsReferenceLinks.isVisualStudio(remote) ? organization : null);
      this.organizationText.set(organization);
    }
    catch (error) {
      if (!(error instanceof WindowException))
        throw error;
      this.context.log(Resources.formatRequestFailed(GitNames.statusMethod, String(error)));
    }
    finally {
      done();
    }
  }

  private showSignIn(next: HostSignIn): void {
    if (next.state !== this.signIn()?.state) {
      this.failure.set(null);
      this.hasToken.set(false);
    }
    this.signIn.set(next);
  }
}
