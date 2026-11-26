/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { computed, Injector, signal, type WritableSignal } from "@angular/core";
import { type ComponentFixture, TestBed } from "@angular/core/testing";
import "@noldova/context.core";
import { FakeWindowPartContext } from "@noldova/desktop.window/testing";
import { describe, expect, it, onTestFinished } from "vitest";

import { GitWorkspacesComponent } from "../../../../src/app/components/git-workspaces/git-workspaces.component.ts";
import { GitWorkspaceView } from "../../../../src/app/enums/git-workspace-view.ts";
import type { GitWorkspace } from "../../../../src/app/models/git-workspace.ts";
import { GitWorkspaceSide } from "../../../../src/app/models/git-workspace-side.ts";
import { GitRecentRepositories } from "../../../../src/app/services/git-recent-repositories.ts";
import { GitWorkspaces } from "../../../../src/app/services/git-workspaces.ts";
import { GitWorkspaceSides } from "../../../../src/app/services/git-workspace-sides.ts";
import { GitFixtures } from "../../../fixtures/git-fixtures.fixture.ts";
import { GitWorkspaceViewCount } from "../../../../src/app/models/git-workspace-view-count.ts";

describe("GitWorkspacesComponent", () => {
  const fresh = (): GitWorkspace => {
    localStorage.clear();
    GitWorkspaces.restore();
    GitRecentRepositories.restore();
    onTestFinished(() => {
      localStorage.clear();
      GitWorkspaces.restore();
      GitRecentRepositories.restore();
    });
    return GitWorkspaces.create("Notes");
  };

  const render = (context: FakeWindowPartContext): ComponentFixture<GitWorkspacesComponent> => {
    context.allow("openDocument");
    GitFixtures.setUp(context);
    const fixture: ComponentFixture<GitWorkspacesComponent> = TestBed.createComponent(GitWorkspacesComponent);
    fixture.autoDetectChanges();
    return fixture;
  };

  const elementOf = (fixture: ComponentFixture<GitWorkspacesComponent>): HTMLElement => {
    const element: unknown = fixture.nativeElement;
    if (!(element instanceof HTMLElement))
      throw new Error("The view isn't rendered.");
    return element;
  };

  const texts = (fixture: ComponentFixture<GitWorkspacesComponent>, selector: string): readonly string[] =>
    [...elementOf(fixture).querySelectorAll(selector)].map(element => {
      const walker: TreeWalker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
      const pieces: string[] = [];
      for (let node: Node | null = walker.nextNode(); !Object.isNull(node); node = walker.nextNode())
        pieces.push((node.textContent ?? "").trim());
      return pieces.filter(t => t.length > 0).join(" ");
    });

  const click = (fixture: ComponentFixture<GitWorkspacesComponent>, selector: string, index: number = 0): void => {
    elementOf(fixture).querySelectorAll<HTMLElement>(selector)[index]?.click();
    fixture.detectChanges();
  };

  it("lists the Dashboard and the workspaces with nothing chosen, and no views or hosts, while no workspace page is open, and opens a page from each", () => {
    const workspace: GitWorkspace = fresh();
    const context: FakeWindowPartContext = new FakeWindowPartContext();
    const fixture: ComponentFixture<GitWorkspacesComponent> = render(context);

    click(fixture, ".open-repositories");
    click(fixture, ".workspace");

    expect([texts(fixture, ".row:not(.heading)"), texts(fixture, ".selected"), texts(fixture, ".section .caps"), context.callsOf("openDocument")]).toEqual([
      ["dashboard Dashboard 0", "workspaces Notes 0"], [], ["Workspaces"],
      [["git.workspace", "open", "Dashboard"], ["git.workspace", workspace.id, "Notes"]]
    ]);
  });

  it("chooses the page in front's workspace until it shows a view, keeps a chosen view on a second choice, and shows all again from that page's own item only", () => {
    const workspace: GitWorkspace = fresh();
    const context: FakeWindowPartContext = new FakeWindowPartContext();
    const fixture: ComponentFixture<GitWorkspacesComponent> = render(context);
    const view: WritableSignal<GitWorkspaceView | null> = signal(null);
    const chosen: (GitWorkspaceView | null)[] = [];
    const side: GitWorkspaceSide = new GitWorkspaceSide(workspace.id, view, computed(() => Object.values(GitWorkspaceView).map(t => new GitWorkspaceViewCount(t, 0))),
      signal([]), t => {
        chosen.push(t);
        view.set(t);
      });
    GitWorkspaceSides.of(context).follow(signal(side), signal(true), TestBed.inject(Injector));
    fixture.detectChanges();
    const before: readonly string[] = texts(fixture, ".selected");

    click(fixture, ".view", 1);
    click(fixture, ".view", 1);
    const viewing: readonly string[] = texts(fixture, ".selected");
    click(fixture, ".open-repositories");
    click(fixture, ".workspace");

    expect([before, viewing, texts(fixture, ".selected"), chosen, texts(fixture, ".section .caps")]).toEqual([
      ["workspaces Notes 0"], ["edit_note With uncommitted changes"], ["workspaces Notes 0"], [GitWorkspaceView.Changed, null], ["Workspaces", "Views"]
    ]);
  });
});
