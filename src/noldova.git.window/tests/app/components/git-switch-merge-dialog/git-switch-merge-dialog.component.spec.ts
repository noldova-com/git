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

import { GitSwitchMergeDialogComponent } from "../../../../src/app/components/git-switch-merge-dialog/git-switch-merge-dialog.component.ts";
import { GitBranchDrop } from "../../../../src/app/models/git-branch-drop.ts";

const opened: DialogRef<unknown, GitSwitchMergeDialogComponent>[] = [];

class Dialog {
  public readonly answers: boolean[] = [];
  private readonly host: HTMLElement;

  public constructor(drop: GitBranchDrop) {
    const dialog = TestBed.inject(DialogService).open(GitSwitchMergeDialogComponent, ".cancel");
    opened.push(dialog);
    dialog.componentRef?.setInput("drop", drop);
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

const drop: GitBranchDrop = new GitBranchDrop("feature/kit", "a".repeat(40), "release", "b".repeat(40), "main", true);

describe("GitSwitchMergeDialogComponent", () => {
  afterEach(() => {
    for (const dialog of opened.splice(0))
      dialog.close();
  });

  it("names both steps: the switch to the target, then the merge of the dropped branch into it", () => {
    const dialog: Dialog = new Dialog(drop);

    expect([dialog.texts(".nol-dialog-title"), dialog.texts(".text"), dialog.texts("button[nolDialogAction]")]).toEqual([["Switch and merge?"],
      ["Git first switches to release, then merges feature/kit into it. You stay on release afterwards."], ["Switch and merge", "Cancel"]]);
  });

  it("answers true for Switch and merge, and false for Cancel and for Close", () => {
    const dialog: Dialog = new Dialog(drop);

    dialog.click(".switch-merge");
    dialog.click(".cancel");
    dialog.click(".nol-dialog-close");

    expect(dialog.answers).toEqual([true, false, false]);
  });
});
