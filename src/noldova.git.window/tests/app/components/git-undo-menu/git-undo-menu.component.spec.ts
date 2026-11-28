/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ApplicationRef, ErrorHandler, signal, type WritableSignal } from "@angular/core";
import { type ComponentFixture, TestBed } from "@angular/core/testing";
import "@noldova/context.core";
import { DatePattern } from "@noldova/desktop.protocol";
import { GitJournalEntry, UndoMode } from "@noldova/git.protocol";
import { afterEach, describe, expect, it } from "vitest";

import { GitUndoMenuComponent } from "../../../../src/app/components/git-undo-menu/git-undo-menu.component.ts";
import { GitViewStateService } from "../../../../src/app/services/git-view-state.service.ts";
import { TimeFormatsFixture } from "../../../fixtures/time-formats.fixture.ts";

const AT: string = "2026-11-22T20:15:00Z";
const time: string = DatePattern.format(new Date(AT), "MMM d, h:mm a");

function entryOf(id: string, method: string, branch: string | null, undo: UndoMode): GitJournalEntry {
  const tree: string | null = undo === UndoMode.Index ? "4b825dc642cb6eb9a060e54bf8d69288fbee4904" : null;
  return new GitJournalEntry(id, method, AT, branch, branch, [], undo, tree, tree);
}

class Menu {
  public readonly recentActions: WritableSignal<readonly GitJournalEntry[]> = signal([]);
  public readonly busy: WritableSignal<boolean> = signal(false);
  public readonly undone: GitJournalEntry[] = [];
  public readonly handled: unknown[] = [];
  public reads: number = 0;
  public failure: Error | null = null;
  public readonly fixture: ComponentFixture<GitUndoMenuComponent>;

  public constructor() {
    const state = { recentActions: this.recentActions, busy: this.busy, readRecentActionsAsync: async (): Promise<void> => {
      this.reads++;
      if (!Object.isNull(this.failure))
        throw this.failure;
    }, undoEntryAsync: async (entry: GitJournalEntry): Promise<void> => {
      this.undone.push(entry);
    } };
    TestBed.configureTestingModule({ providers: [{ provide: GitViewStateService, useValue: state },
      { provide: ErrorHandler, useValue: { handleError: (error: unknown) => this.handled.push(error) } }] });
    this.fixture = TestBed.createComponent(GitUndoMenuComponent);
    this.fixture.autoDetectChanges();
  }

  public get items(): readonly HTMLElement[] {
    return [...document.querySelectorAll<HTMLElement>("button[nol-menu-item]")];
  }

  public rows(): readonly (readonly unknown[])[] {
    const parts = (row: HTMLElement): string => [...row.querySelectorAll("*")].filter(t => t.children.length === 0).map(t => (t.textContent ?? "").trim())
      .filter(t => t !== "").join("|");
    return this.items.map(t => [parts(t), t.getAttribute("aria-disabled") === "true"] as const);
  }

  public async openAsync(): Promise<void> {
    const button: unknown = this.fixture.nativeElement instanceof HTMLElement ? this.fixture.nativeElement.querySelector(".recent") : null;
    if (!(button instanceof HTMLButtonElement))
      throw new Error("The menu has no button.");
    button.click();
    await this.settleAsync();
  }

  public async settleAsync(): Promise<void> {
    await this.fixture.whenStable();
    TestBed.inject(ApplicationRef).tick();
    await this.fixture.whenStable();
  }
}

describe("GitUndoMenuComponent", () => {
  afterEach(() => TimeFormatsFixture.reset());

  it("reads the recent actions as it opens, and says there are none yet", async () => {
    const menu: Menu = new Menu();

    await menu.openAsync();

    expect([menu.reads, menu.rows()]).toEqual([1, [["No actions yet", true]]]);
  });

  it("lists each action on its branch with its time, offering Undo only for one Git can undo", async () => {
    const menu: Menu = new Menu();
    menu.recentActions.set([entryOf("8", "git.example", null, UndoMode.None), entryOf("7", "git.push", "main", UndoMode.None),
      entryOf("6", "git.stage", "main", UndoMode.Index)]);

    await menu.openAsync();

    expect(menu.rows()).toEqual([[`git.example|${time}`, true], [`Push on main|${time}`, true], [`Stage on main|${time}|Undo`, false]]);
  });

  it("shows each action's time by the date and time format setting, and again when it changes", async () => {
    const menu: Menu = new Menu();
    menu.recentActions.set([entryOf("7", "git.push", "main", UndoMode.None)]);
    await menu.openAsync();
    const before: readonly (readonly unknown[])[] = menu.rows();
    TimeFormatsFixture.use24Hour();
    await menu.fixture.whenStable();

    expect([before, menu.rows()]).toEqual([[[`Push on main|${time}`, true]], [[`Push on main|${DatePattern.format(new Date(AT), "d MMM, HH:mm")}`, true]]]);
  });

  it("names a fetch and a rebase", async () => {
    const menu: Menu = new Menu();
    menu.recentActions.set([entryOf("9", "git.fetch", "main", UndoMode.None), entryOf("8", "git.rebase", "main", UndoMode.None)]);

    await menu.openAsync();

    expect(menu.rows()).toEqual([[`Fetch on main|${time}`, true], [`Rebase on main|${time}`, true]]);
  });

  it("holds every Undo while Git is busy", async () => {
    const menu: Menu = new Menu();
    menu.recentActions.set([entryOf("6", "git.stage", "main", UndoMode.Index)]);
    menu.busy.set(true);

    await menu.openAsync();

    expect(menu.rows().map(t => t[1])).toEqual([true]);
  });

  it("undoes the action chosen", async () => {
    const menu: Menu = new Menu();
    const stage: GitJournalEntry = entryOf("6", "git.stage", "main", UndoMode.Index);
    menu.recentActions.set([stage]);
    await menu.openAsync();

    menu.items[0]?.click();
    await menu.settleAsync();

    expect(menu.undone).toEqual([stage]);
  });

  it("passes a read that fails to the window's error handler", async () => {
    const menu: Menu = new Menu();
    menu.failure = new Error("The runtime went away.");

    await menu.openAsync();

    expect(menu.handled).toEqual([menu.failure]);
  });
});
