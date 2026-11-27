/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { createEnvironmentInjector, DestroyRef, EnvironmentInjector, type Signal, signal, type WritableSignal } from "@angular/core";
import { TestBed } from "@angular/core/testing";
import { FakeWindowPartContext } from "@noldova/desktop.window/testing";
import { AzureDevOpsNames } from "@noldova/git.azure-devops.protocol";
import { HostAccount, HostSignIn } from "@noldova/git.hosting.protocol";
import { describe, expect, it } from "vitest";

import { SignedInChoice } from "../../../src/app/services/signed-in-choice.ts";

class Shown {
  public readonly name: string;

  public constructor(name: string) {
    this.name = name;
  }
}

describe("SignedInChoice", () => {
  const signedIn: HostSignIn = HostSignIn.signedIn(new HostAccount("monalisa@example.com", "Mona Lisa", null, []));

  it("passes the shown choice on, hides the one shown when the sign-in changes, and passes on the next one shown", () => {
    const context = new FakeWindowPartContext();
    const injector: EnvironmentInjector = createEnvironmentInjector([], TestBed.inject(EnvironmentInjector));
    const first = new Shown("first");
    const shown: WritableSignal<Shown | null> = signal<Shown | null>(first);
    const choice: Signal<Shown | null> = SignedInChoice.of(context, shown, injector.get(DestroyRef));
    const before: Shown | null = choice();

    context.raiseEvent(AzureDevOpsNames.signInChangedEvent, HostSignIn.waitingInBrowser("https://login.microsoftonline.com/example").toJson());
    const waiting: Shown | null = choice();
    context.raiseEvent(AzureDevOpsNames.signInChangedEvent, HostSignIn.signedOut().toJson());
    const signedOut: Shown | null = choice();
    context.raiseEvent(AzureDevOpsNames.signInChangedEvent, signedIn.toJson());
    const signedInAgain: Shown | null = choice();
    const second = new Shown("second");
    shown.set(second);

    expect([before, waiting, signedOut, signedInAgain, choice()]).toEqual([first, first, null, null, second]);
    injector.destroy();
  });

  it("stops following the sign-in once its owner is destroyed", () => {
    const context = new FakeWindowPartContext();
    const injector: EnvironmentInjector = createEnvironmentInjector([], TestBed.inject(EnvironmentInjector));
    SignedInChoice.of(context, signal<Shown | null>(null), injector.get(DestroyRef));
    const following: number = context.activeCallsOf("onEvent").length;

    injector.destroy();

    expect([following, context.activeCallsOf("onEvent")]).toEqual([1, []]);
  });
});
