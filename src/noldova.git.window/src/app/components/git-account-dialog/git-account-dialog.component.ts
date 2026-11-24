/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { NgComponentOutlet } from "@angular/common";
import { Component, computed, inject, Injector, input, type InputSignal, output, type OutputEmitterRef, type Signal } from "@angular/core";
import { WindowPartTokens } from "@noldova/desktop.window";
import { DialogComponent } from "@noldova/ui.components.angular";

import type { IProvidedGitHostAccount } from "../../interfaces/i-provided-git-host-account.ts";

@Component({
  selector: "nol-git-account-dialog",
  imports: [DialogComponent, NgComponentOutlet],
  templateUrl: "./git-account-dialog.component.html"
})
export class GitAccountDialogComponent {
  private readonly injector: Injector = inject(Injector);

  protected readonly hostInjector: Signal<Injector> = computed(() =>
    Injector.create({ providers: [{ provide: WindowPartTokens.context, useValue: this.account().context }], parent: this.injector }));

  public readonly account: InputSignal<IProvidedGitHostAccount> = input.required<IProvidedGitHostAccount>();
  public readonly title: InputSignal<string> = input.required<string>();
  public readonly closed: OutputEmitterRef<void> = output<void>();
}
