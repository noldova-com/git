/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { type ComponentFixture, TestBed } from "@angular/core/testing";
import "@noldova/context.core";
import { FakeWindowPartContext } from "@noldova/desktop.window/testing";
import { DefaultTheme } from "@noldova/ui.components.angular";
import { AppearanceFixture } from "@noldova/ui.components.angular/testing";
import type {} from "@vitest/browser-playwright";
import { afterEach, describe, expect, it, onTestFinished } from "vitest";
import { page } from "vitest/browser";

import { GitWorkspacesComponent } from "../../../../src/app/components/git-workspaces/git-workspaces.component.ts";
import { GitRecentRepositories } from "../../../../src/app/services/git-recent-repositories.ts";
import { GitWorkspaces } from "../../../../src/app/services/git-workspaces.ts";
import { GitFixtures } from "../../../fixtures/git-fixtures.fixture.ts";

describe("GitWorkspacesComponent in the kit's look", () => {
  const screenshots: string = "../../../../../../_build/window/screenshots";
  const rem = (pixels: number): number => Math.round(pixels / parseFloat(getComputedStyle(document.documentElement).fontSize) * 1000) / 1000 + 0;
  const box = (element: Element | null): DOMRect => element?.getBoundingClientRect() ?? new DOMRect();

  afterEach(() => {
    AppearanceFixture.reset();
  });

  it.each(AppearanceFixture.modes)("ends the Workspaces header's add glyph where the Dashboard's and a workspace's counts end, in %s mode", async mode => {
    AppearanceFixture.apply(DefaultTheme.theme, mode);
    localStorage.clear();
    GitWorkspaces.restore();
    GitRecentRepositories.restore();
    onTestFinished(() => {
      localStorage.clear();
      GitWorkspaces.restore();
      GitRecentRepositories.restore();
    });
    GitWorkspaces.create("Notes");
    const context: FakeWindowPartContext = new FakeWindowPartContext();
    context.allow("openDocument");
    GitFixtures.setUp(context);
    const fixture: ComponentFixture<GitWorkspacesComponent> = TestBed.createComponent(GitWorkspacesComponent);
    fixture.autoDetectChanges();
    const element: HTMLElement = fixture.nativeElement;
    element.style.width = "16rem";
    await fixture.whenStable();
    await page.screenshot({ element, path: `${screenshots}/git-workspaces-${mode}.png` });
    const glyph: DOMRect = box(element.querySelector(".heading .new .nol-icon-button-glyph"));
    const dashboard: DOMRect = box(element.querySelector(".open-repositories .count"));
    const workspace: DOMRect = box(element.querySelector(".workspace .count"));
    const probe: HTMLElement = document.body.appendChild(document.createElement("div"));
    probe.style.width = "var(--nol-icon)";
    const icon: number = rem(box(probe).width);
    probe.remove();

    expect(rem(glyph.width)).toBe(icon);
    expect([rem(glyph.right - dashboard.right), rem(glyph.right - workspace.right)]).toEqual([0, 0]);
  });
});
