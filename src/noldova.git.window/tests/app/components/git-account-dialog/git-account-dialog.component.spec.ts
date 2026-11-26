/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { DialogRef } from "@angular/cdk/dialog";
import { ApplicationRef, Component, inject, signal } from "@angular/core";
import { TestBed } from "@angular/core/testing";
import { type IWindowPartContext, WindowPartTokens } from "@noldova/desktop.window";
import { FakeWindowPartContext } from "@noldova/desktop.window/testing";
import { DialogService } from "@noldova/ui.components.angular";
import { afterEach, describe, expect, it } from "vitest";

import { GitAccountDialogComponent } from "../../../../src/app/components/git-account-dialog/git-account-dialog.component.ts";
import type { IProvidedGitHostAccount } from "../../../../src/app/interfaces/i-provided-git-host-account.ts";

const signInContexts: IWindowPartContext[] = [];

@Component({ selector: "nol-git-test-sign-in", template: "<p class=\"test-sign-in\">Sign-in</p>" })
class TestSignInComponent {
  public constructor() {
    signInContexts.push(inject(WindowPartTokens.context));
  }
}

class OpenedDialog {
  public readonly host: HTMLElement;
  public readonly closes: number[];

  public constructor(host: HTMLElement, closes: number[]) {
    this.host = host;
    this.closes = closes;
  }
}

const opened: DialogRef<unknown, GitAccountDialogComponent>[] = [];

function open(account: IProvidedGitHostAccount): OpenedDialog {
  const dialog = TestBed.inject(DialogService).open(GitAccountDialogComponent, ".nol-dialog-close");
  opened.push(dialog);
  dialog.componentRef?.setInput("account", account);
  dialog.componentRef?.setInput("title", "Sign in to GitHub");
  const closes: number[] = [];
  dialog.componentInstance?.closed.subscribe(() => closes.push(closes.length + 1));
  const host: unknown = dialog.componentRef?.location.nativeElement;
  if (!(host instanceof HTMLElement))
    throw new Error("The dialog didn't open.");
  TestBed.inject(ApplicationRef).tick();
  return new OpenedDialog(host, closes);
}

describe("GitAccountDialogComponent", () => {
  afterEach(() => {
    signInContexts.length = 0;
    for (const dialog of opened.splice(0))
      dialog.close();
  });

  it("shows the host's sign-in under its title, giving it the host's own context rather than the window's", () => {
    const windowContext = new FakeWindowPartContext();
    const github = new FakeWindowPartContext();
    TestBed.configureTestingModule({ providers: [{ provide: WindowPartTokens.context, useValue: windowContext }] });
    const account: IProvidedGitHostAccount = { context: github, account: { id: "github", host: "GitHub", column: "GitHub", mark: "github", markColor: "#24292f",
      cards: signal([]), signIn: TestSignInComponent, features: [] } };

    const { host } = open(account);

    expect([host.querySelector(".nol-dialog-title")?.textContent?.trim(), host.querySelector(".test-sign-in")?.textContent, signInContexts.length,
      signInContexts[0] === github]).toEqual(["Sign in to GitHub", "Sign-in", 1, true]);
  });

  it("says it closed once dismissed", () => {
    const account: IProvidedGitHostAccount = { context: new FakeWindowPartContext(), account: { id: "github", host: "GitHub", column: "GitHub", mark: "github",
      markColor: "#24292f", cards: signal([]), signIn: TestSignInComponent, features: [] } };
    const { host, closes } = open(account);

    host.querySelector<HTMLButtonElement>(".nol-dialog-close")?.click();

    expect(closes).toEqual([1]);
  });
});
