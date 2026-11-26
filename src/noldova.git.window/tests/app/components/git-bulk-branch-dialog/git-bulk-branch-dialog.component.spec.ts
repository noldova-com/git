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

import { GitBulkBranchDialogComponent } from "../../../../src/app/components/git-bulk-branch-dialog/git-bulk-branch-dialog.component.ts";

const opened: DialogRef<unknown, GitBulkBranchDialogComponent>[] = [];

class Dialog {
  public readonly answers: (string | null)[] = [];
  private readonly host: HTMLElement;

  public constructor(repositories: readonly string[]) {
    const dialog = TestBed.inject(DialogService).open(GitBulkBranchDialogComponent, ".name");
    opened.push(dialog);
    dialog.componentRef?.setInput("repositories", repositories);
    dialog.componentInstance?.answered.subscribe(t => this.answers.push(t));
    const host: unknown = dialog.componentRef?.location.nativeElement;
    if (!(host instanceof HTMLElement))
      throw new Error("The dialog didn't open.");
    this.host = host;
    TestBed.inject(ApplicationRef).tick();
  }

  public get field(): HTMLInputElement {
    const field = this.host.querySelector(".name");
    if (!(field instanceof HTMLInputElement))
      throw new Error("The dialog has no name field.");
    return field;
  }

  public get create(): HTMLButtonElement {
    return this.button(".create");
  }

  public texts(selector: string): readonly string[] {
    return [...this.host.querySelectorAll(selector)].map(t => (t.textContent ?? "").trim());
  }

  public type(name: string): void {
    this.field.value = name;
    this.field.dispatchEvent(new Event("input"));
    TestBed.inject(ApplicationRef).tick();
  }

  public button(selector: string): HTMLButtonElement {
    const button = this.host.querySelector(selector);
    if (!(button instanceof HTMLButtonElement))
      throw new Error(`The dialog has no ${selector}.`);
    return button;
  }
}

describe("GitBulkBranchDialogComponent", () => {
  afterEach(() => {
    for (const dialog of opened.splice(0))
      dialog.close();
  });

  it("titles the branch for the count of repositories, names each one, and offers Create and Cancel", () => {
    const one: Dialog = new Dialog(["git"]);
    const three: Dialog = new Dialog(["ui", "git", "terminal"]);

    expect([one.texts(".nol-dialog-title"), three.texts(".nol-dialog-title"), three.texts(".targets li"), three.texts(".text"), three.texts("button[nolDialogAction]")])
      .toEqual([["New branch in one repository"], ["New branch in three repositories"], ["ui", "git", "terminal"],
        ["Each repository gets the branch at its current commit and switches to it:"], ["Create", "Cancel"]]);
  });

  it("keeps Create unavailable, saying nothing, until a name is typed", () => {
    const dialog: Dialog = new Dialog(["git"]);

    expect([dialog.create.disabled, dialog.texts("[role=alert]"), dialog.field.getAttribute("aria-invalid")]).toEqual([true, [], "false"]);
  });

  it("refuses a name Git doesn't take, saying why under the field, and answers nothing for Create or Enter", () => {
    const dialog: Dialog = new Dialog(["git"]);

    dialog.type("feature kit");
    dialog.create.click();
    dialog.field.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter" }));

    expect([dialog.create.disabled, dialog.texts("[role=alert]"), dialog.field.getAttribute("aria-invalid"), dialog.answers])
      .toEqual([true, ["Git doesn't take this as a branch name."], "true", []]);
  });

  it("answers the name for Create and for Enter once Git takes it", () => {
    const dialog: Dialog = new Dialog(["git"]);

    dialog.type("feature/kit");
    dialog.create.click();
    dialog.field.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter" }));

    expect([dialog.create.disabled, dialog.texts("[role=alert]"), dialog.answers]).toEqual([false, [], ["feature/kit", "feature/kit"]]);
  });

  it("answers null for Cancel and for Close", () => {
    const dialog: Dialog = new Dialog(["git"]);

    dialog.button(".cancel").click();
    dialog.button(".nol-dialog-close").click();

    expect(dialog.answers).toEqual([null, null]);
  });
});
