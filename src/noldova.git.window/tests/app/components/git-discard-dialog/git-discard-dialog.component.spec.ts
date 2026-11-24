/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ApplicationRef } from "@angular/core";
import { TestBed } from "@angular/core/testing";
import { DialogService } from "@noldova/ui.components.angular";
import { describe, expect, it, onTestFinished } from "vitest";
import { userEvent } from "vitest/browser";

import { GitDiscardDialogComponent } from "../../../../src/app/components/git-discard-dialog/git-discard-dialog.component.ts";

describe("GitDiscardDialogComponent", () => {
  class Dialog {
    public readonly answers: boolean[] = [];
    public readonly host: HTMLElement | null;

    public constructor(path: string, untracked: boolean, undoable: boolean) {
      const dialog = TestBed.inject(DialogService).open(GitDiscardDialogComponent, ".cancel");
      onTestFinished(() => dialog.close());
      const host: unknown = dialog.componentRef?.location.nativeElement;
      this.host = host instanceof HTMLElement ? host : null;
      dialog.componentRef?.setInput("path", path);
      dialog.componentRef?.setInput("untracked", untracked);
      dialog.componentRef?.setInput("undoable", undoable);
      dialog.componentInstance?.answered.subscribe(t => {
        this.answers.push(t);
        dialog.close();
      });
    }

    public static async openAsync(path: string = "src/a.ts", untracked: boolean = false, undoable: boolean = false): Promise<Dialog> {
      const dialog: Dialog = new Dialog(path, untracked, undoable);
      await Dialog.settleAsync();
      return dialog;
    }

    public static async settleAsync(): Promise<void> {
      const application: ApplicationRef = TestBed.inject(ApplicationRef);
      await application.whenStable();
      application.tick();
      await application.whenStable();
    }

    public text(selector: string): string {
      return (this.host?.querySelector(selector)?.textContent ?? "").trim();
    }

    public async clickAsync(selector: string): Promise<void> {
      this.host?.querySelector<HTMLElement>(selector)?.click();
      await Dialog.settleAsync();
    }
  }

  it.each([
    ["an untracked file that is deleted for good", "d.ts", true, false, "d.ts isn't tracked, so discarding deletes it. This can't be undone."],
    ["an untracked file a checkpoint keeps", "d.ts", true, true, "d.ts isn't tracked, so discarding deletes it. A checkpoint is kept, so you can undo it."],
    ["a tracked file that goes back for good", "docs/c.md", false, false,
      "The changes to docs/c.md in the working folder will be lost, and it goes back to what is staged. This can't be undone."],
    ["a tracked file a checkpoint keeps", "docs/c.md", false, true,
      "The changes to docs/c.md in the working folder will be lost, and it goes back to what is staged. A checkpoint is kept, so you can undo it."]
  ])("asks before discarding %s, saying what is lost and whether it can be undone", async (_, path, untracked, undoable, text) => {
    const dialog: Dialog = await Dialog.openAsync(path, untracked, undoable);

    expect([dialog.text(".nol-dialog-title"), dialog.text(".text"), dialog.text(".discard"), dialog.text(".cancel")]).toEqual(["Discard changes?", text, "Discard", "Cancel"]);
  });

  it("starts on Cancel, and answers true for Discard", async () => {
    const dialog: Dialog = await Dialog.openAsync();
    const focused: boolean = document.activeElement?.matches(".cancel") ?? false;

    await dialog.clickAsync(".discard");

    expect([focused, dialog.answers]).toEqual([true, [true]]);
  });

  it("answers false for Cancel", async () => {
    const dialog: Dialog = await Dialog.openAsync();

    await dialog.clickAsync(".cancel");

    expect(dialog.answers).toEqual([false]);
  });

  it("answers false when it is closed", async () => {
    const dialog: Dialog = await Dialog.openAsync();

    await dialog.clickAsync(".nol-dialog-close");

    expect(dialog.answers).toEqual([false]);
  });

  it("answers false for Escape", async () => {
    const dialog: Dialog = await Dialog.openAsync();

    await userEvent.keyboard("{Escape}");
    await Dialog.settleAsync();

    expect(dialog.answers).toEqual([false]);
  });
});
