/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Dialog } from "@angular/cdk/dialog";
import { ApplicationRef, Injector } from "@angular/core";
import { TestBed } from "@angular/core/testing";
import { afterEach, describe, expect, it } from "vitest";

import { BranchDialog } from "../../../src/app/services/branch-dialog.ts";
import { BranchDialog as BranchDialogPage, BranchDialogData, BranchDialogReads } from "../../fixtures/branch-dialog.fixture.ts";

async function settleAsync(): Promise<void> {
  const application: ApplicationRef = TestBed.inject(ApplicationRef);
  await application.whenStable();
  application.tick();
  await application.whenStable();
}

function host(): HTMLElement {
  const element = document.querySelector("nol-git-azure-devops-branch");
  if (!(element instanceof HTMLElement))
    throw new Error("The dialog isn't open.");
  return element;
}

describe("BranchDialog", () => {
  afterEach(() => {
    TestBed.inject(Dialog).closeAll();
  });

  it("opens the branch dialog for the request, reading through the window part's context, and closes it once the dialog says it's done", async () => {
    const page: BranchDialogPage = new BranchDialogPage().answerReads(new BranchDialogReads());

    BranchDialog.open(page.context, BranchDialogData.request, TestBed.inject(Injector));
    await settleAsync();
    const title: string = (host().querySelector(".nol-dialog-title")?.textContent ?? "").trim();
    const open: number = TestBed.inject(Dialog).openDialogs.length;
    const cancel = [...host().querySelectorAll(".nol-dialog-actions > button[nolDialogAction]")].find(t => (t.textContent ?? "").trim() === "Cancel");
    if (!(cancel instanceof HTMLButtonElement))
      throw new Error("The dialog has no Cancel.");
    cancel.click();
    await settleAsync();

    expect([title, page.requests.methods.length > 0, open, TestBed.inject(Dialog).openDialogs.length]).toEqual(["Create a branch for 7532", true, 1, 0]);
  });
});
