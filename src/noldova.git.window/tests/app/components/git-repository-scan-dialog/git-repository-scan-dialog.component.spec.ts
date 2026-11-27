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
import { DefaultTheme, DialogService } from "@noldova/ui.components.angular";
import { AppearanceFixture } from "@noldova/ui.components.angular/testing";
import { afterEach, describe, expect, it } from "vitest";

import { GitRepositoryScanDialogComponent } from "../../../../src/app/components/git-repository-scan-dialog/git-repository-scan-dialog.component.ts";

const opened: DialogRef<unknown, GitRepositoryScanDialogComponent>[] = [];

class Dialog {
  public readonly answers: (readonly string[] | null)[] = [];
  public readonly host: HTMLElement;

  public constructor(folder: string, repositories: readonly string[]) {
    const dialog = TestBed.inject(DialogService).open(GitRepositoryScanDialogComponent, ".open");
    opened.push(dialog);
    dialog.componentRef?.setInput("folder", folder);
    dialog.componentRef?.setInput("repositories", repositories);
    dialog.componentInstance?.answered.subscribe(t => this.answers.push(t));
    const host: unknown = dialog.componentRef?.location.nativeElement;
    if (!(host instanceof HTMLElement))
      throw new Error("The dialog didn't open.");
    this.host = host;
    TestBed.inject(ApplicationRef).tick();
  }

  public get open(): HTMLButtonElement {
    return this.button(".open");
  }

  public texts(selector: string): readonly string[] {
    return [...this.host.querySelectorAll(selector)].map(t => (t.textContent ?? "").trim());
  }

  public ticks(): readonly boolean[] {
    return [...this.host.querySelectorAll<HTMLInputElement>(".repository input")].map(t => t.checked);
  }

  public tick(index: number): void {
    this.host.querySelectorAll<HTMLInputElement>(".repository input")[index]?.click();
    TestBed.inject(ApplicationRef).tick();
  }

  public button(selector: string): HTMLButtonElement {
    const button = this.host.querySelector(selector);
    if (!(button instanceof HTMLButtonElement))
      throw new Error(`The dialog has no ${selector}.`);
    return button;
  }
}

describe("GitRepositoryScanDialogComponent", () => {
  const rem = (pixels: number): number => Math.round(pixels / parseFloat(getComputedStyle(document.documentElement).fontSize) * 1000) / 1000;
  const box = (element: Element | null): DOMRect => element?.getBoundingClientRect() ?? new DOMRect();

  afterEach(() => {
    for (const dialog of opened.splice(0))
      dialog.close();
    AppearanceFixture.reset();
  });

  it("titles the count found in the folder, lists each repository under it ticked, and offers Open and Cancel", () => {
    const one: Dialog = new Dialog("/work", ["/work/site"]);
    const three: Dialog = new Dialog("C:\\work\\", ["C:\\work\\api", "C:\\work\\site", "C:\\work\\site\\packages\\kit"]);

    expect([one.texts(".nol-dialog-title"), three.texts(".nol-dialog-title"), three.texts(".repositories li"), three.ticks(), three.texts(".text"),
      three.texts("button[nolDialogAction]"), [...three.host.querySelectorAll("li")].map(t => t.getAttribute("title"))])
      .toEqual([["One repository in work"], ["Three repositories in work"], ["api", "site", "site\\packages\\kit"], [true, true, true], ["The ticked ones open:"],
        ["Open", "Cancel"], ["C:\\work\\api", "C:\\work\\site", "C:\\work\\site\\packages\\kit"]]);
  });

  it("answers the repositories still ticked for Open, and keeps Open unavailable once none is", () => {
    const dialog: Dialog = new Dialog("/work", ["/work/api", "/work/site"]);

    dialog.tick(0);
    const ticks: readonly boolean[] = dialog.ticks();
    dialog.open.click();
    dialog.tick(1);
    const none: boolean = dialog.open.disabled;
    dialog.tick(0);
    dialog.open.click();

    expect([ticks, none, dialog.answers]).toEqual([[false, true], true, [["/work/site"], ["/work/api"]]]);
  });

  it("answers null for Cancel and for Close", () => {
    const dialog: Dialog = new Dialog("/work", ["/work/site"]);

    dialog.button(".cancel").click();
    dialog.button(".nol-dialog-close").click();

    expect(dialog.answers).toEqual([null, null]);
  });

  it.each(AppearanceFixture.modes)("lines the repositories up under the text, a quarter rem apart, and scrolls a long list within 20rem, in %s mode", mode => {
    AppearanceFixture.apply(DefaultTheme.theme, mode);
    const dialog: Dialog = new Dialog("/work", Array.from({ length: 40 }, (_, index) => `/work/repository-${index}`));

    const text: DOMRect = box(dialog.host.querySelector(".text"));
    const list: HTMLElement | null = dialog.host.querySelector(".repositories");
    const rows: DOMRect[] = [...dialog.host.querySelectorAll(".repositories li")].map(t => box(t));
    const first: DOMRect = rows[0] ?? new DOMRect();
    const second: DOMRect = rows[1] ?? new DOMRect();
    const checkbox: DOMRect = box(dialog.host.querySelector(".repository input"));

    expect([rem(first.left - text.left), rem(checkbox.left - text.left), rem(box(list).top - text.bottom), rem(second.top - first.bottom), rem(box(list).height)])
      .toEqual([0, 0, 0.5, 0.25, 20]);
    expect([list?.scrollHeight ?? 0].map(t => t > (list?.clientHeight ?? 0))).toEqual([true]);
  });
});
