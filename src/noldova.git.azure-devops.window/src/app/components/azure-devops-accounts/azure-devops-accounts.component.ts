/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Component, computed, DestroyRef, inject, type OnInit, PendingTasks, type Signal, signal, type WritableSignal } from "@angular/core";
import "@noldova/context.core";
import { type IWindowPartContext, WindowException, WindowPartTokens } from "@noldova/desktop.window";
import { AzureDevOpsNames } from "@noldova/git.azure-devops.protocol";
import { type HostAccountEntry, HostAccountList, SignInState } from "@noldova/git.hosting.protocol";
import { GitHostAccounts } from "@noldova/git.window";
import { ButtonComponent, ButtonVariant } from "@noldova/ui.components.angular";

import { Resources } from "../../../resources.ts";
import { AccountEvents } from "../../services/account-events.ts";
import { AzureDevOpsSignInComponent } from "../azure-devops-sign-in/azure-devops-sign-in.component.ts";

@Component({
  selector: "nol-git-azure-devops-accounts",
  templateUrl: "./azure-devops-accounts.component.html",
  styleUrl: "../azure-devops-sign-in/azure-devops-sign-in.component.css",
  imports: [AzureDevOpsSignInComponent, ButtonComponent]
})
export class AzureDevOpsAccountsComponent implements OnInit {
  private readonly context: IWindowPartContext = inject(WindowPartTokens.context);
  private readonly destroyRef: DestroyRef = inject(DestroyRef);
  private readonly tasks: PendingTasks = inject(PendingTasks);
  private readonly chosen: number | null = AzureDevOpsAccountsComponent.idOf(inject(GitHostAccounts.chosenAccount, { optional: true }) ?? null);
  private changes: number = 0;

  protected readonly resources: typeof Resources = Resources;
  protected readonly secondary: ButtonVariant = ButtonVariant.Secondary;
  protected readonly list: WritableSignal<HostAccountList | null> = signal<HostAccountList | null>(null);
  protected readonly isRead: WritableSignal<boolean> = signal<boolean>(false);
  protected readonly added: WritableSignal<number | null> = signal<number | null>(null);
  protected readonly isAdding: WritableSignal<boolean> = signal<boolean>(false);
  protected readonly shown: Signal<readonly number[]> = computed(() => {
    if (!this.isRead())
      return [];
    const ids: readonly number[] = this.list()?.accounts.map(t => t.id) ?? [];
    if (!Object.isNull(this.chosen) && (ids.length === 0 || ids.includes(this.chosen)))
      return [this.chosen];
    return ids.length === 0 ? [Resources.firstAccount] : ids;
  });
  protected readonly canAdd: Signal<boolean> = computed(() => {
    const accounts: readonly HostAccountEntry[] = this.list()?.accounts ?? [];
    return this.shown().length === accounts.length && accounts.some(t => t.signIn.state === SignInState.SignedIn)
      && !accounts.some(t => t.signIn.state === SignInState.Waiting);
  });

  public ngOnInit(): void {
    this.destroyRef.onDestroy(AccountEvents.follow(this.context, list => {
      this.changes++;
      this.list.set(list);
      this.isRead.set(true);
    }));
    void this.readAsync();
  }

  protected noteAdded(entry: HostAccountEntry): void {
    this.added.set(entry.id);
    this.list.update(t => AzureDevOpsAccountsComponent.withEntry(t, entry));
    this.isAdding.set(false);
  }

  private async readAsync(): Promise<void> {
    const done = this.tasks.add();
    const changes: number = this.changes;
    try {
      const list = HostAccountList.fromJson(await this.context.requestAsync(AzureDevOpsNames.readAccountsMethod, null));
      if (this.changes === changes)
        this.list.set(list);
    }
    catch (error) {
      if (!(error instanceof WindowException))
        throw error;
      this.context.log(Resources.formatRequestFailed(AzureDevOpsNames.readAccountsMethod, String(error)));
    }
    finally {
      this.isRead.set(true);
      done();
    }
  }

  private static withEntry(list: HostAccountList | null, entry: HostAccountEntry): HostAccountList | null {
    return Object.isNull(list) || list.accounts.some(t => t.id === entry.id) ? list : new HostAccountList([...list.accounts, entry]);
  }

  private static idOf(chosen: string | null): number | null {
    const id: number = Number(chosen);
    return Number.isSafeInteger(id) && id >= Resources.firstAccount ? id : null;
  }
}
