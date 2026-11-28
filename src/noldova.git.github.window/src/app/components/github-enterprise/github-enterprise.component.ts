/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Component, computed, DestroyRef, ElementRef, inject, type OnInit, PendingTasks, signal, type Signal, viewChild, type WritableSignal } from "@angular/core";
import "@noldova/context.core";
import { type IWindowPartContext, LinkPlace, RuntimeRequestException, WindowException, WindowPartTokens } from "@noldova/desktop.window";
import { GitHubNames } from "@noldova/git.github.protocol";
import { AccountQuery, type HostAccount, HostAccountEntry, HostAccountList, SignInState } from "@noldova/git.hosting.protocol";
import { GitHostAccounts } from "@noldova/git.window";
import { AvatarComponent, ButtonComponent, ButtonVariant, TextFieldComponent } from "@noldova/ui.components.angular";

import type { EnterpriseEntry } from "../../models/enterprise-entry.ts";
import { SignInNotice } from "../../models/sign-in-notice.ts";
import { SignedInEnterprise } from "../../models/signed-in-enterprise.ts";
import { Resources } from "../../../resources.ts";
import { AccountEvents } from "../../services/account-events.ts";
import { GitHubAccountList } from "../../services/github-account-list.ts";

@Component({
  selector: "nol-git-github-enterprise",
  templateUrl: "./github-enterprise.component.html",
  styleUrls: ["../github-sign-in/github-sign-in.component.css", "./github-enterprise.component.css"],
  imports: [AvatarComponent, ButtonComponent, TextFieldComponent]
})
export class GitHubEnterpriseComponent implements OnInit {
  private readonly context: IWindowPartContext = inject(WindowPartTokens.context);
  private readonly destroyRef: DestroyRef = inject(DestroyRef);
  private readonly tasks: PendingTasks = inject(PendingTasks);
  private readonly serverField: Signal<ElementRef<HTMLInputElement>> = viewChild.required("serverField", { read: ElementRef });
  private readonly tokenField: Signal<ElementRef<HTMLInputElement>> = viewChild.required("tokenField", { read: ElementRef });
  private readonly list: WritableSignal<readonly EnterpriseEntry[]> = signal<readonly EnterpriseEntry[]>([]);
  private readonly connected: WritableSignal<number | null> = signal<number | null>(null);
  private readonly chosen: number | null = GitHubEnterpriseComponent.idOf(inject(GitHostAccounts.chosenAccount, { optional: true }) ?? null);
  private changes: number = 0;
  private isRead: boolean = false;

  protected readonly resources: typeof Resources = Resources;
  protected readonly secondary: ButtonVariant = ButtonVariant.Secondary;
  protected readonly isBusy: WritableSignal<boolean> = signal<boolean>(false);
  protected readonly hasToken: WritableSignal<boolean> = signal<boolean>(false);
  protected readonly failure: WritableSignal<string | null> = signal<string | null>(null);
  protected readonly serverText: WritableSignal<string> = signal<string>("");
  protected readonly server: Signal<string> = computed(() => this.serverText().trim().toLowerCase());
  protected readonly entry: Signal<EnterpriseEntry | null> = computed(() => {
    const id: number | null = this.connected() ?? this.chosen;
    return this.list().find(t => t.id === id) ?? null;
  });
  protected readonly signedIn: Signal<SignedInEnterprise | null> = computed(() => {
    const entry: EnterpriseEntry | null = this.entry();
    const person: HostAccount | null = Object.isNull(entry) ? null : entry.signIn.account;
    return Object.isNull(entry) || Object.isNull(person) ? null : new SignedInEnterprise(entry, person);
  });
  protected readonly notice: Signal<SignInNotice | null> = computed(() => {
    const failure = this.entry()?.signIn.failure ?? null;
    return Object.isNull(failure) ? null : new SignInNotice(Resources.failureTitles[failure], Resources.failureHints[failure]);
  });

  public ngOnInit(): void {
    this.destroyRef.onDestroy(AccountEvents.follow(this.context, list => {
      this.changes++;
      this.show(list);
    }));
    void this.readAsync();
  }

  protected initialOf(account: HostAccount): string {
    return account.login.charAt(0).toUpperCase();
  }

  protected nameOf(account: HostAccount): string {
    return account.name ?? account.login;
  }

  protected detailOf(account: HostAccount, entry: EnterpriseEntry): string {
    return Resources.formatServerDetail(account.login, entry.host);
  }

  protected noteServer(): void {
    this.serverText.set(this.serverField().nativeElement.value);
  }

  protected noteToken(): void {
    this.hasToken.set(this.tokenField().nativeElement.value.trim() !== "");
  }

  protected async connectAsync(): Promise<void> {
    const field: HTMLInputElement = this.tokenField().nativeElement;
    const token: string = field.value.trim();
    if (token === "" || this.server() === "" || this.isBusy())
      return;
    const done = this.tasks.add();
    const earlier: EnterpriseEntry | null = this.entry();
    this.isBusy.set(true);
    this.failure.set(null);
    try {
      const entry = HostAccountEntry.fromJson(await this.context.requestAsync(GitHubNames.signInWithTokenMethod, { host: this.server(), token }));
      this.list.update(t => [...t.filter(u => u.id !== entry.id), ...GitHubAccountList.enterpriseOf(new HostAccountList([entry]))]);
      if (entry.signIn.state !== SignInState.SignedIn) {
        this.failure.set(Object.isNull(entry.signIn.failure) ? Resources.connectUnanswered : Resources.failureTitles[entry.signIn.failure]);
        return;
      }
      this.connected.set(entry.id);
      if (!Object.isNull(earlier))
        await this.forgetAsync(earlier.id);
    }
    catch (error) {
      if (!(error instanceof WindowException))
        throw error;
      this.context.log(Resources.formatRequestFailed(GitHubNames.signInWithTokenMethod, String(error)));
      this.failure.set(error instanceof RuntimeRequestException ? error.message : Resources.connectUnanswered);
    }
    finally {
      field.value = "";
      this.hasToken.set(false);
      this.isBusy.set(false);
      done();
    }
  }

  protected async signOutAsync(entry: EnterpriseEntry): Promise<void> {
    const done = this.tasks.add();
    this.isBusy.set(true);
    this.failure.set(null);
    try {
      if (!await this.forgetAsync(entry.id))
        return;
      this.connected.set(null);
      this.serverText.set(entry.host);
    }
    finally {
      this.isBusy.set(false);
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
      this.context.log(Resources.formatLinkFailed(url, String(error)));
      this.failure.set(Resources.linkNotOpened);
    }
    finally {
      done();
    }
  }

  private async forgetAsync(id: number): Promise<boolean> {
    try {
      await this.context.requestAsync(GitHubNames.signOutMethod, new AccountQuery(id).toJson());
      return true;
    }
    catch (error) {
      if (!(error instanceof WindowException))
        throw error;
      this.context.log(Resources.formatRequestFailed(GitHubNames.signOutMethod, String(error)));
      this.failure.set(Resources.signInUnanswered);
      return false;
    }
  }

  private async readAsync(): Promise<void> {
    const done = this.tasks.add();
    const changes: number = this.changes;
    try {
      const list = HostAccountList.fromJson(await this.context.requestAsync(GitHubNames.readAccountsMethod, null));
      if (this.changes === changes)
        this.show(list);
    }
    catch (error) {
      if (!(error instanceof WindowException))
        throw error;
      this.context.log(Resources.formatRequestFailed(GitHubNames.readAccountsMethod, String(error)));
    }
    finally {
      done();
    }
  }

  private show(list: HostAccountList): void {
    const isFirst: boolean = !this.isRead;
    this.isRead = true;
    this.list.set(GitHubAccountList.enterpriseOf(list));
    const entry: EnterpriseEntry | null = this.entry();
    if (isFirst && !Object.isNull(entry))
      this.serverText.set(entry.host);
  }

  private static idOf(chosen: string | null): number | null {
    return Object.isNull(chosen) ? null : Number(chosen);
  }
}
