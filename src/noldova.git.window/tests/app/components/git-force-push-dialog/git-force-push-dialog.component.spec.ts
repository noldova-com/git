/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { DialogRef } from "@angular/cdk/dialog";
import { ApplicationRef } from "@angular/core";
import { TestBed } from "@angular/core/testing";
import { DialogService } from "@noldova/ui.components.angular";
import { afterEach, describe, expect, it } from "vitest";

import { GitForcePushDialogComponent } from "../../../../src/app/components/git-force-push-dialog/git-force-push-dialog.component.ts";
import { GitForcePushOffer } from "../../../../src/app/models/git-force-push-offer.ts";

const opened: DialogRef<unknown, GitForcePushDialogComponent>[] = [];

class Dialog {
  public readonly answers: boolean[] = [];
  private readonly host: HTMLElement;

  public constructor(offer: GitForcePushOffer) {
    const dialog = TestBed.inject(DialogService).open(GitForcePushDialogComponent, ".cancel");
    opened.push(dialog);
    dialog.componentRef?.setInput("offer", offer);
    dialog.componentInstance?.answered.subscribe(t => this.answers.push(t));
    const host: unknown = dialog.componentRef?.location.nativeElement;
    if (!(host instanceof HTMLElement))
      throw new Error("The dialog didn't open.");
    this.host = host;
    TestBed.inject(ApplicationRef).tick();
  }

  public texts(selector: string): readonly string[] {
    return [...this.host.querySelectorAll(selector)].map(t => (t.textContent ?? "").trim());
  }

  public click(selector: string): void {
    const button = this.host.querySelector(selector);
    if (!(button instanceof HTMLButtonElement))
      throw new Error(`The dialog has no ${selector}.`);
    button.click();
  }
}

describe("GitForcePushDialogComponent", () => {
  afterEach(() => {
    for (const dialog of opened.splice(0))
      dialog.close();
  });

  it("says what a force push replaces and that it holds only while the upstream is still at the commit the last fetch saw, by its short id", () => {
    const dialog: Dialog = new Dialog(new GitForcePushOffer("feature/kit", "origin/feature/kit", "0123456789abcdef0123456789abcdef01234567"));

    expect([dialog.texts(".nol-dialog-title"), dialog.texts(".text"), dialog.texts("button[nolDialogAction]")]).toEqual([["Force push with lease?"],
      ["This replaces the commits origin/feature/kit has that feature/kit doesn't with feature/kit's, only while origin/feature/kit still points at 0123456, "
        + "as the last fetch saw it. If anyone pushed since, the remote refuses it and nothing changes."], ["Force push", "Cancel"]]);
  });

  it("answers true for Force push and false for Cancel", () => {
    const dialog: Dialog = new Dialog(new GitForcePushOffer("main", "origin/main", "abcdef0"));

    dialog.click(".force");
    dialog.click(".cancel");

    expect(dialog.answers).toEqual([true, false]);
  });
});
