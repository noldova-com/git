/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { computed, Injector, signal } from "@angular/core";
import { type ComponentFixture, TestBed } from "@angular/core/testing";
import "@noldova/context.core";
import { FakeWindowPartContext } from "@noldova/desktop.window/testing";
import { GitRemote, RemoteTransport } from "@noldova/git.protocol";
import { DefaultTheme } from "@noldova/ui.components.angular";
import { AppearanceFixture } from "@noldova/ui.components.angular/testing";
import type {} from "@vitest/browser-playwright";
import { afterEach, describe, expect, it, onTestFinished } from "vitest";
import { page } from "vitest/browser";

import { GitWorkspacesComponent } from "../../../../src/app/components/git-workspaces/git-workspaces.component.ts";
import { GitWorkspaceView } from "../../../../src/app/enums/git-workspace-view.ts";
import type { GitWorkspace } from "../../../../src/app/models/git-workspace.ts";
import { GitRepositorySummary } from "../../../../src/app/models/git-repository-summary.ts";
import { GitWorkspaceHost } from "../../../../src/app/models/git-workspace-host.ts";
import { GitWorkspaceRow } from "../../../../src/app/models/git-workspace-row.ts";
import { GitWorkspaceSide } from "../../../../src/app/models/git-workspace-side.ts";
import { GitWorkspaceViewCount } from "../../../../src/app/models/git-workspace-view-count.ts";
import { GitRecentRepositories } from "../../../../src/app/services/git-recent-repositories.ts";
import { GitWorkspaceSides } from "../../../../src/app/services/git-workspace-sides.ts";
import { GitWorkspaces } from "../../../../src/app/services/git-workspaces.ts";
import { GitFixtures } from "../../../fixtures/git-fixtures.fixture.ts";
import { RightEdge } from "../../../fixtures/right-edge.fixture.ts";

describe("GitWorkspacesComponent in the kit's look", () => {
  const screenshots: string = "../../../../../../_build/window/screenshots";

  afterEach(() => {
    AppearanceFixture.reset();
  });

  it.each(AppearanceFixture.modes)("ends the header's add glyph, the counts, a view's badge and a host's detail 0.75rem inside the panel, in %s mode", async mode => {
    AppearanceFixture.apply(DefaultTheme.theme, mode);
    localStorage.clear();
    GitWorkspaces.restore();
    GitRecentRepositories.restore();
    onTestFinished(() => {
      localStorage.clear();
      GitWorkspaces.restore();
      GitRecentRepositories.restore();
    });
    const workspace: GitWorkspace = GitWorkspaces.create("Notes");
    const context: FakeWindowPartContext = new FakeWindowPartContext();
    context.allow("openDocument");
    GitFixtures.setUp(context);
    const remote = new GitRemote("origin", "nas.home", "notes", RemoteTransport.Ssh);
    const row = new GitWorkspaceRow("/work/notes", signal(new GitRepositorySummary("/work/notes", GitFixtures.status([], null, { remote }), false, null)), signal(undefined), signal(false));
    const side = new GitWorkspaceSide(workspace.id, signal(GitWorkspaceView.Changed), computed(() => Object.values(GitWorkspaceView).map(t => new GitWorkspaceViewCount(t, 12))),
      signal(GitWorkspaceHost.listOf([row], () => null)), () => undefined);
    GitWorkspaceSides.of(context).follow(signal(side), signal(true), TestBed.inject(Injector));
    const fixture: ComponentFixture<GitWorkspacesComponent> = TestBed.createComponent(GitWorkspacesComponent);
    fixture.autoDetectChanges();
    const element: HTMLElement = fixture.nativeElement;
    element.style.width = "16rem";
    await fixture.whenStable();
    await page.screenshot({ element, path: `${screenshots}/git-workspaces-${mode}.png` });
    const ends: readonly string[] = [".new", ".open-repositories .count", ".workspace .count", ".view .badge", ".host .small"];

    expect(RightEdge.missesOf(element, RightEdge.insideOf(element, 0.75), ends)).toEqual([]);
  });
});
