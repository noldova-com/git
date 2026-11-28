/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Component, inject, type Signal } from "@angular/core";
import type { HostAccount } from "@noldova/git.hosting.protocol";
import { AvatarComponent, ButtonComponent, ButtonVariant, ChipComponent, ChipKind, DialogService, IconButtonComponent, MenuComponent, MenuItemComponent, MenuTriggerDirective,
  TooltipDirective } from "@noldova/ui.components.angular";

import { GitHostCardState } from "../../enums/git-host-card-state.ts";
import type { GitHostFeature } from "../../enums/git-host-feature.ts";
import type { IProvidedGitHostAccount } from "../../interfaces/i-provided-git-host-account.ts";
import type { GitHostCard } from "../../models/git-host-card.ts";
import { Resources } from "../../../resources.ts";
import { GitHostAccounts } from "../../services/git-host-accounts.ts";
import { GitAccountDialogComponent } from "../git-account-dialog/git-account-dialog.component.ts";

@Component({
  selector: "nol-git-accounts",
  imports: [AvatarComponent, ButtonComponent, ChipComponent, IconButtonComponent, MenuComponent, MenuItemComponent, MenuTriggerDirective, TooltipDirective],
  templateUrl: "./git-accounts.component.html",
  styleUrl: "./git-accounts.component.css"
})
export class GitAccountsComponent {
  private readonly dialogs: DialogService = inject(DialogService);

  protected readonly resources: typeof Resources = Resources;
  protected readonly secondary: ButtonVariant = ButtonVariant.Secondary;
  protected readonly accounts: Signal<readonly IProvidedGitHostAccount[]> = GitHostAccounts.accounts;

  protected rowOf(provided: IProvidedGitHostAccount): string {
    return `${Resources.accountRowPrefix}${provided.account.id}`;
  }

  protected chipOf(card: GitHostCard): ChipKind {
    return card.state === GitHostCardState.SignedIn ? ChipKind.On : ChipKind.Status;
  }

  protected initialOf(person: HostAccount): string {
    return person.login.charAt(0).toUpperCase();
  }

  protected has(provided: IProvidedGitHostAccount, feature: GitHostFeature): boolean {
    return provided.account.features.includes(feature);
  }

  protected open(provided: IProvidedGitHostAccount, title: string, chosen: string | null = null): void {
    const dialog = this.dialogs.open(GitAccountDialogComponent);
    dialog.componentRef?.setInput(Resources.accountInput, provided);
    dialog.componentRef?.setInput(Resources.dialogTitleInput, title);
    dialog.componentRef?.setInput(Resources.chosenAccountInput, chosen);
    dialog.componentInstance?.closed.subscribe(() => {
      dialog.close();
    });
  }
}
