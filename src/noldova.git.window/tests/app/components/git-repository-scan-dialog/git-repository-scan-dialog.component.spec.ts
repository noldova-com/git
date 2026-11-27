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
import type {} from "@vitest/browser-playwright";
import { afterEach, describe, expect, it } from "vitest";
import { page } from "vitest/browser";

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

  public allTicked(): boolean {
    return this.host.querySelector<HTMLInputElement>(".all input")?.checked ?? false;
  }

  public tickAll(): void {
    this.host.querySelector<HTMLInputElement>(".all input")?.click();
    TestBed.inject(ApplicationRef).tick();
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
  const screenshots: string = "../../../../../../_build/window/screenshots";
  const rem = (pixels: number): number => Math.round(pixels / parseFloat(getComputedStyle(document.documentElement).fontSize) * 1000) / 1000;
  const box = (element: Element | null): DOMRect => element?.getBoundingClientRect() ?? new DOMRect();

  afterEach(() => {
    for (const dialog of opened.splice(0))
      dialog.close();
    AppearanceFixture.reset();
  });

  it("titles the count found in the folder, lists each repository under it ticked by name and place, and offers All, Open and Cancel", () => {
    const one: Dialog = new Dialog("/work", ["/work/site"]);
    const three: Dialog = new Dialog("C:\\work\\", ["C:\\work\\api", "C:\\work\\site", "C:\\work\\site\\packages\\kit"]);

    expect([one.texts(".nol-dialog-title"), three.texts(".nol-dialog-title"), three.texts(".repositories .name"), three.texts(".repositories .place"), three.ticks(),
      three.texts(".text"), three.texts(".all"), three.allTicked(), three.texts("button[nolDialogAction]"), [...three.host.querySelectorAll("li")].map(t => t.getAttribute("title"))])
      .toEqual([["One repository in work"], ["Three repositories in work"], ["api", "site", "kit"], ["site\\packages"], [true, true, true], ["The ticked ones open:"], ["All"], true,
        ["Open", "Cancel"], ["C:\\work\\api", "C:\\work\\site", "C:\\work\\site\\packages\\kit"]]);
  });

  it("answers the repositories still ticked for Open, ticks and unticks them all from All, and keeps Open unavailable once none is ticked", () => {
    const dialog: Dialog = new Dialog("/work", ["/work/api", "/work/site"]);

    dialog.tick(0);
    const one: readonly unknown[] = [dialog.ticks(), dialog.allTicked()];
    dialog.open.click();
    dialog.tickAll();
    const all: readonly unknown[] = [dialog.ticks(), dialog.allTicked()];
    dialog.tickAll();
    const none: readonly unknown[] = [dialog.ticks(), dialog.allTicked(), dialog.open.disabled];
    dialog.tick(0);
    dialog.open.click();

    expect([one, all, none, dialog.answers]).toEqual([[[false, true], false], [[true, true], true], [[false, false], false, true], [["/work/site"], ["/work/api"]]]);
  });

  it("answers null for Cancel and for Close", () => {
    const dialog: Dialog = new Dialog("/work", ["/work/site"]);

    dialog.button(".cancel").click();
    dialog.button(".nol-dialog-close").click();

    expect(dialog.answers).toEqual([null, null]);
  });

  it.each(AppearanceFixture.modes)("lines All and the repositories up under the text, shows twelve whole rows with the last inside the scroll edge, and keeps a long place inside its row, in %s mode",
    async mode => {
      AppearanceFixture.apply(DefaultTheme.theme, mode);
      const long: string = `/work/${"nested-folder/".repeat(12)}kit`;
      const dialog: Dialog = new Dialog("/work", [long, ...Array.from({ length: 40 }, (_, index) => `/work/repository-${index}`)]);

      const text: DOMRect = box(dialog.host.querySelector(".text"));
      const all: DOMRect = box(dialog.host.querySelector(".all input"));
      const list: Element | null = dialog.host.querySelector(".repositories");
      const frame: DOMRect = box(list);
      const rows: DOMRect[] = [...dialog.host.querySelectorAll(".repositories li")].map(t => box(t));
      const first: DOMRect = rows[0] ?? new DOMRect();
      const second: DOMRect = rows[1] ?? new DOMRect();
      const shown: DOMRect[] = rows.filter(t => t.top < frame.bottom);
      const last: DOMRect = shown.at(-1) ?? new DOMRect();
      const label: DOMRect = box(dialog.host.querySelector(".repositories .label"));
      const name: DOMRect = box(dialog.host.querySelector(".repositories .name"));

      expect([rem(all.left - text.left), rem(all.top - text.bottom), rem(first.left - text.left), rem(second.top - first.bottom)]).toEqual([0, 0.5, 0, 0.25]);
      expect([shown.length, rem(frame.bottom - last.bottom), new Set(rows.map(t => rem(t.height))).size, (list?.scrollHeight ?? 0) > (list?.clientHeight ?? 0)])
        .toEqual([12, 0, 1, true]);
      expect([label.right <= first.right, name.left >= first.left, name.right <= label.right, rem(first.height)]).toEqual([true, true, true, rem(second.height)]);

      const panel: Element = dialog.host.closest(".cdk-overlay-pane") ?? dialog.host;
      await page.screenshot({ element: panel, path: `${screenshots}/git-repository-scan-dialog-${mode}.png` });
    });
});
