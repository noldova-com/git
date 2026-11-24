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
import { describe, expect, it } from "vitest";

import { GitNewBranch } from "../../../src/app/services/git-new-branch.ts";

function dialog(): HTMLElement {
  const host = document.querySelector("nol-git-bulk-branch-dialog");
  if (!(host instanceof HTMLElement))
    throw new Error("No branch dialog is open.");
  return host;
}

function click(selector: string): void {
  const button = dialog().querySelector(selector);
  if (!(button instanceof HTMLButtonElement))
    throw new Error(`The dialog has no ${selector}.`);
  button.click();
}

describe("GitNewBranch", () => {
  it("asks for the name in the branch dialog for the one repository, answers the name on Create and closes the dialog", async () => {
    const answer: Promise<string | null> = GitNewBranch.askAsync(TestBed.inject(DialogService), "git");
    TestBed.inject(ApplicationRef).tick();
    const title: string | undefined = dialog().querySelector(".nol-dialog-title")?.textContent?.trim();
    const targets: readonly string[] = [...dialog().querySelectorAll(".targets li")].map(t => (t.textContent ?? "").trim());
    const field = dialog().querySelector(".name");
    if (!(field instanceof HTMLInputElement))
      throw new Error("The dialog has no name field.");
    field.value = "feature/kit";
    field.dispatchEvent(new Event("input"));
    TestBed.inject(ApplicationRef).tick();

    click(".create");

    expect([title, targets, await answer]).toEqual(["New branch in one repository", ["git"], "feature/kit"]);
    TestBed.inject(ApplicationRef).tick();
    expect(document.querySelector("nol-git-bulk-branch-dialog")).toBeNull();
  });

  it("answers null on Cancel and closes the dialog", async () => {
    const answer: Promise<string | null> = GitNewBranch.askAsync(TestBed.inject(DialogService), "git");
    TestBed.inject(ApplicationRef).tick();

    click(".cancel");

    expect(await answer).toBeNull();
    TestBed.inject(ApplicationRef).tick();
    expect(document.querySelector("nol-git-bulk-branch-dialog")).toBeNull();
  });
});
