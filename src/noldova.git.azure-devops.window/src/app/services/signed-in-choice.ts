/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { computed, type DestroyRef, type Signal, signal, untracked, type WritableSignal } from "@angular/core";
import "@noldova/context.core";
import type { IWindowPartContext } from "@noldova/desktop.window";
import { SignInState } from "@noldova/git.hosting.protocol";

import { SignInEvents } from "./sign-in-events.ts";

export class SignedInChoice {
  public static of<T>(context: IWindowPartContext, shown: Signal<T | null>, destroyRef: DestroyRef): Signal<T | null> {
    const withheld: WritableSignal<T | null> = signal<T | null>(null);
    destroyRef.onDestroy(SignInEvents.follow(context, signIn => {
      if (signIn.state !== SignInState.Waiting)
        withheld.set(untracked(shown));
    }));
    return computed(() => {
      const choice: T | null = shown();
      return choice === withheld() ? null : choice;
    });
  }
}
