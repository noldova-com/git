/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { createEnvironmentInjector, EnvironmentInjector, signal, type WritableSignal } from "@angular/core";
import { TestBed } from "@angular/core/testing";
import { FakeWindowPartContext } from "@noldova/desktop.window/testing";
import { AzureDevOpsNames } from "@noldova/git.azure-devops.protocol";
import { HostAccount, HostSignIn } from "@noldova/git.hosting.protocol";
import { describe, expect, it, onTestFinished } from "vitest";

import { SignedInDetailView } from "../../../src/app/services/signed-in-detail-view.ts";

class Shown {
  public readonly name: string;

  public constructor(name: string) {
    this.name = name;
  }
}

describe("SignedInDetailView", () => {
  const signedIn: HostSignIn = HostSignIn.signedIn(new HostAccount("monalisa@example.com", "Mona Lisa", null, []));

  function viewOf(context: FakeWindowPartContext, chosen: WritableSignal<Shown | null>): SignedInDetailView<Shown> {
    const injector: EnvironmentInjector = createEnvironmentInjector([], TestBed.inject(EnvironmentInjector));
    onTestFinished(() => injector.destroy());
    const view = new SignedInDetailView<Shown>(context, "git-azure-devops.pullRequestDetail", "selected", t => t.name);
    view.follow(chosen, signal(true), injector);
    return view;
  }

  it("passes the shown choice on, withholds the one shown when the sign-in changes while it listens, and passes on the next one shown", () => {
    const context = new FakeWindowPartContext();
    const first = new Shown("first");
    const chosen: WritableSignal<Shown | null> = signal<Shown | null>(first);
    const view: SignedInDetailView<Shown> = viewOf(context, chosen);
    onTestFinished(view.listen());
    const before: Shown | null = view.choice();

    context.raiseEvent(AzureDevOpsNames.signInChangedEvent, HostSignIn.waitingInBrowser("https://login.microsoftonline.com/example").toJson());
    const waiting: Shown | null = view.choice();
    context.raiseEvent(AzureDevOpsNames.signInChangedEvent, HostSignIn.signedOut().toJson());
    const signedOut: Shown | null = view.choice();
    context.raiseEvent(AzureDevOpsNames.signInChangedEvent, signedIn.toJson());
    const signedInAgain: Shown | null = view.choice();
    const second = new Shown("second");
    chosen.set(second);

    expect([before, waiting, signedOut, signedInAgain, view.shown(), view.choice()]).toEqual([first, first, null, null, second, second]);
  });

  it("stops following the sign-in and the view's closing once its listening is withdrawn", () => {
    const context = new FakeWindowPartContext();
    const first = new Shown("first");
    const view: SignedInDetailView<Shown> = viewOf(context, signal<Shown | null>(first));
    const withdraw: () => void = view.listen();
    const following: number = context.activeCallsOf("onEvent").length;

    withdraw();
    context.raiseEvent(AzureDevOpsNames.signInChangedEvent, HostSignIn.signedOut().toJson());

    expect([following, context.activeCallsOf("onEvent"), context.activeCallsOf("onViewClosed"), view.choice()]).toEqual([1, [], [], first]);
  });
});
