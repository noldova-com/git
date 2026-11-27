/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { FakeWindowPartContext } from "@noldova/desktop.window/testing";
import { describe, expect, it, onTestFinished } from "vitest";

import type { GitWorkspace } from "../../../src/app/models/git-workspace.ts";
import { GitRecentRepositories } from "../../../src/app/services/git-recent-repositories.ts";
import { GitWorkspacePages } from "../../../src/app/services/git-workspace-pages.ts";
import { GitWorkspaces } from "../../../src/app/services/git-workspaces.ts";

describe("GitWorkspacePages", () => {
  const fresh = (): void => {
    localStorage.clear();
    GitWorkspaces.restore();
    GitRecentRepositories.restore();
    onTestFinished(() => {
      localStorage.clear();
      GitWorkspaces.restore();
      GitRecentRepositories.restore();
    });
  };

  it("opens a workspace's page as its own tab, named for it", () => {
    fresh();
    const context: FakeWindowPartContext = new FakeWindowPartContext();
    const workspace: GitWorkspace = GitWorkspaces.create("Websites");

    GitWorkspacePages.open(context, workspace.id);

    expect(context.callsOf("openDocument")).toEqual([["git.workspace", workspace.id, "Websites"]]);
  });

  it("opens the open repositories' page for no workspace, and for one that's gone", () => {
    fresh();
    const context: FakeWindowPartContext = new FakeWindowPartContext();
    const workspace: GitWorkspace = GitWorkspaces.create("Websites");
    GitWorkspaces.remove(workspace.id);

    GitWorkspacePages.open(context, null);
    GitWorkspacePages.open(context, workspace.id);

    expect(context.callsOf("openDocument")).toEqual([["git.workspace", "open", "Dashboard"], ["git.workspace", "open", "Dashboard"]]);
  });

  it("opens a repository's history named for its folder, leaving the repositories opened lately as they were until the history reads it", () => {
    fresh();
    const context: FakeWindowPartContext = new FakeWindowPartContext();
    GitRecentRepositories.remember("/work/site");
    GitRecentRepositories.remember("/work/api");

    GitWorkspacePages.openRepository(context, "/work/site");

    expect([context.callsOf("openDocument"), GitRecentRepositories.recent().slice(0, 2)]).toEqual([[["git.history", "/work/site", "site"]], ["/work/api", "/work/site"]]);
  });
});
