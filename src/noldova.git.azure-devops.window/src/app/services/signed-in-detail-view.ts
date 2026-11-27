/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { computed, type Signal, signal, untracked, type WritableSignal } from "@angular/core";
import type { IWindowPartContext } from "@noldova/desktop.window";
import { SignInState } from "@noldova/git.hosting.protocol";
import { GitDetailView } from "@noldova/git.window";

import { SignInEvents } from "./sign-in-events.ts";

export class SignedInDetailView<T> extends GitDetailView<T> {
  public readonly choice: Signal<T | null>;
  private readonly signIns: IWindowPartContext;
  private readonly withheld: WritableSignal<T | null> = signal<T | null>(null);

  public constructor(context: IWindowPartContext, view: string, instance: string, titleOf: (choice: T) => string) {
    super(context, view, instance, titleOf);
    this.signIns = context;
    this.choice = computed(() => {
      const shown: T | null = this.shown();
      return shown === this.withheld() ? null : shown;
    });
  }

  public override listen(): () => void {
    const withdrawClosed: () => void = super.listen();
    const withdrawSignIns: () => void = SignInEvents.follow(this.signIns, signIn => {
      if (signIn.state !== SignInState.Waiting)
        this.withheld.set(untracked(this.shown));
    });
    return () => {
      withdrawClosed();
      withdrawSignIns();
    };
  }
}
