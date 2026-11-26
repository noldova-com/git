/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { type ComponentFixture, TestBed } from "@angular/core/testing";
import { FakeWindowPartContext } from "@noldova/desktop.window/testing";
import { describe, expect, it } from "vitest";

import { GitFileLayoutButtonComponent } from "../../../../src/app/components/git-file-layout-button/git-file-layout-button.component.ts";
import { GitFileLayout } from "../../../../src/app/enums/git-file-layout.ts";
import { GitViewStateService } from "../../../../src/app/services/git-view-state.service.ts";
import { GitFixtures } from "../../../fixtures/git-fixtures.fixture.ts";

describe("GitFileLayoutButtonComponent", () => {
  class LayoutButton {
    public readonly context: FakeWindowPartContext = new FakeWindowPartContext();
    public readonly state: GitViewStateService;
    public readonly fixture: ComponentFixture<GitFileLayoutButtonComponent>;

    public constructor() {
      GitFixtures.answerWith(this.context, { ...GitFixtures.watching, "git.status": GitFixtures.status().toJson() });
      GitFixtures.setUp(this.context, [GitViewStateService]);
      this.state = TestBed.inject(GitViewStateService);
      this.fixture = TestBed.createComponent(GitFileLayoutButtonComponent);
      this.fixture.componentRef.setInput("layout", this.state.fileLayout);
      this.fixture.autoDetectChanges();
    }

    public get button(): HTMLButtonElement | null {
      const host: HTMLElement = this.fixture.nativeElement;
      return host.querySelector<HTMLButtonElement>("button.layout");
    }

    public get icon(): string {
      return (this.button?.textContent ?? "").trim();
    }

    public get rows(): readonly HTMLElement[] {
      return [...document.querySelectorAll<HTMLElement>("button[nol-menu-item]")];
    }

    public read(icons: readonly string[]): readonly (readonly (string | boolean)[])[] {
      return this.rows.map((t, i) => [(t.querySelector(".nol-menu-item-label")?.textContent ?? "").trim(), (t.textContent ?? "").includes(icons[i] ?? "-"),
        t.getAttribute("aria-checked") === "true"]);
    }

    public async openAsync(): Promise<void> {
      this.button?.click();
      await this.untilAsync(() => this.rows.length > 0);
    }

    public async chooseAsync(label: string): Promise<void> {
      this.rows.find(t => (t.querySelector(".nol-menu-item-label")?.textContent ?? "").trim() === label)?.click();
      await this.untilAsync(() => this.rows.length === 0);
      await this.fixture.whenStable();
    }

    public untilAsync(done: () => boolean): Promise<void> {
      if (done())
        return Promise.resolve();
      return new Promise(resolve => {
        const observer: MutationObserver = new MutationObserver(() => {
          if (!done())
            return;
          observer.disconnect();
          resolve();
        });
        observer.observe(document.body, { attributes: true, characterData: true, childList: true, subtree: true });
      });
    }
  }

  const icons: readonly string[] = ["account_tree", "folder_open", "list"];

  it("shows the layout's icon, named for what it chooses", async () => {
    const button: LayoutButton = new LayoutButton();
    await button.fixture.whenStable();

    expect([button.icon, button.button?.getAttribute("aria-label")]).toEqual(["folder_open", "Show files as"]);
  });

  it("offers a tree, folders and a list, each with its icon, the current one checked", async () => {
    const button: LayoutButton = new LayoutButton();
    await button.fixture.whenStable();

    await button.openAsync();
    const offered: readonly (readonly (string | boolean)[])[] = button.read(icons);
    await button.chooseAsync("Folders");

    expect(offered).toEqual([["Tree", true, false], ["Folders", true, true], ["List", true, false]]);
  });

  it("lays out every list as the chosen row says, and shows its icon", async () => {
    const button: LayoutButton = new LayoutButton();
    await button.fixture.whenStable();

    await button.openAsync();
    await button.chooseAsync("Tree");
    const tree: readonly (string | GitFileLayout)[] = [button.state.fileLayout(), button.icon];
    await button.openAsync();
    const checked: readonly (readonly (string | boolean)[])[] = button.read(icons);
    await button.chooseAsync("List");

    expect([tree, checked.map(t => t[2]), button.state.fileLayout(), button.icon]).toEqual([
      [GitFileLayout.Tree, "account_tree"], [true, false, false], GitFileLayout.List, "list"
    ]);
  });

  it("follows a layout chosen elsewhere", async () => {
    const button: LayoutButton = new LayoutButton();
    await button.fixture.whenStable();

    button.state.fileLayout.set(GitFileLayout.List);
    await button.fixture.whenStable();

    expect(button.icon).toBe("list");
  });
});
