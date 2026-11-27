/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { signal } from "@angular/core";
import { type ComponentFixture, TestBed } from "@angular/core/testing";
import "@noldova/context.core";
import { WindowPartTokens } from "@noldova/desktop.window";
import { FakeWindowPartContext } from "@noldova/desktop.window/testing";
import { describe, expect, it, onTestFinished } from "vitest";

import { GitDashboardComponent } from "../../../../src/app/components/git-dashboard/git-dashboard.component.ts";
import { GitWindowInactiveException } from "../../../../src/app/exceptions/git-window-inactive.exception.ts";
import { GitWindowContext } from "../../../../src/app/services/git-window-context.ts";
import { GitWorkspaceAcrossViews } from "../../../../src/app/services/git-workspace-across-views.ts";
import { GitWorkspaceSides } from "../../../../src/app/services/git-workspace-sides.ts";
import { GitFixtures } from "../../../fixtures/git-fixtures.fixture.ts";

describe("GitDashboardComponent", () => {
  it("shows the Dashboard through Git's own window context, not the one of the module whose placeholder shows it, and asks for a folder there", async () => {
    const git: FakeWindowPartContext = new FakeWindowPartContext();
    const asked: Promise<void> = new Promise(resolve => git.answer("chooseFolderAsync", async () => {
      resolve();
      return null;
    }));
    const host: FakeWindowPartContext = new FakeWindowPartContext();
    host.beStrict();
    onTestFinished(GitWindowContext.provide(git));
    GitFixtures.setUp(host);

    const fixture: ComponentFixture<GitDashboardComponent> = TestBed.createComponent(GitDashboardComponent);
    fixture.detectChanges();
    const element: HTMLElement = fixture.nativeElement;
    element.querySelector<HTMLButtonElement>(".toolbar .add")?.click();
    await asked;

    expect([element.querySelector("main")?.getAttribute("aria-label"), element.querySelector(".toolbar .name")?.textContent?.trim()]).toEqual(["Dashboard", "Dashboard"]);
    expect([git.callsOf("chooseFolderAsync").length, host.callsOf("chooseFolderAsync").length]).toEqual([1, 0]);
  });

  it("is the page in front as a placeholder, which Noldova Desktop makes under an inactive document, so the Workspaces view and Across repositories follow it", () => {
    const git: FakeWindowPartContext = new FakeWindowPartContext();
    onTestFinished(GitWindowContext.provide(git));
    GitFixtures.setUp(new FakeWindowPartContext(), [{ provide: WindowPartTokens.activeDocument, useValue: signal(false) }]);

    TestBed.createComponent(GitDashboardComponent).detectChanges();

    expect([GitWorkspaceSides.of(git).front(), GitWorkspaceAcrossViews.of(git).front()].map(t => Object.isUndefined(t))).toEqual([false, false]);
  });

  it("refuses to show while Git's window part isn't active in the window", () => {
    const host: FakeWindowPartContext = new FakeWindowPartContext();
    TestBed.configureTestingModule({ providers: [{ provide: WindowPartTokens.context, useValue: host }] });

    expect(() => TestBed.createComponent(GitDashboardComponent)).toThrow(GitWindowInactiveException);
  });
});
