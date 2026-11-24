/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { describe, expect, it, onTestFinished, vi } from "vitest";

import type { GitWorkspace } from "../../../src/app/models/git-workspace.ts";
import { GitRecentRepositories } from "../../../src/app/services/git-recent-repositories.ts";
import { GitWorkspaces } from "../../../src/app/services/git-workspaces.ts";

describe("GitWorkspaces", () => {
  const fresh = (): void => {
    localStorage.clear();
    GitWorkspaces.restore();
    GitRecentRepositories.restore();
    onTestFinished(() => {
      vi.restoreAllMocks();
      localStorage.clear();
      GitWorkspaces.restore();
      GitRecentRepositories.restore();
    });
  };

  const stored = (key: string): unknown => JSON.parse(localStorage.getItem(key) ?? "null");

  it("makes, renames, fills, orders and removes workspaces, keeping each change in the window's storage", () => {
    fresh();
    const sites: GitWorkspace = GitWorkspaces.create("Sites");
    const apps: GitWorkspace = GitWorkspaces.create("Apps");
    GitWorkspaces.rename(sites.id, "Websites");
    GitWorkspaces.addFolder(sites.id, "/a");
    GitWorkspaces.addFolder(sites.id, "/b");
    GitWorkspaces.addFolder(sites.id, "/c");
    GitWorkspaces.moveFolders(sites.id, new Set(["/c"]), -1);
    GitWorkspaces.removeFolders(sites.id, new Set(["/a"]));
    GitWorkspaces.remove(apps.id);

    expect(GitWorkspaces.find(sites.id)?.toJson()).toEqual({ id: sites.id, name: "Websites", folders: ["/c", "/b"] });
    expect([GitWorkspaces.find(apps.id), GitWorkspaces.list().length]).toEqual([null, 1]);
    expect(stored("git.workspaces")).toEqual([{ id: sites.id, name: "Websites", folders: ["/c", "/b"] }]);
  });

  it("reads the workspaces kept, dropping one that no longer reads and keeping the others", () => {
    fresh();
    localStorage.setItem("git.workspaces", JSON.stringify([{ id: "w1", name: "Sites", folders: ["/a"] }, { id: "w2" }, "x"]));

    GitWorkspaces.restore();

    expect(GitWorkspaces.list().map(t => t.toJson())).toEqual([{ id: "w1", name: "Sites", folders: ["/a"] }]);
  });

  it("starts with none when what's kept doesn't read as a list, or storage is out of reach", () => {
    fresh();
    localStorage.setItem("git.workspaces", "{\"id\":\"w1\"}");
    GitWorkspaces.restore();
    const notList: number = GitWorkspaces.list().length;
    localStorage.setItem("git.workspaces", "[");
    GitWorkspaces.restore();
    const unreadable: number = GitWorkspaces.list().length;
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new DOMException("Storage is off.", "SecurityError");
    });
    GitWorkspaces.restore();

    expect([notList, unreadable, GitWorkspaces.list().length]).toEqual([0, 0, 0]);
  });

  it("keeps a change for the window's life when storage can't keep it", () => {
    fresh();
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new DOMException("Storage is full.", "QuotaExceededError");
    });

    GitWorkspaces.create("Sites");
    GitRecentRepositories.remember("/a");

    expect([GitWorkspaces.list().map(t => t.name), GitRecentRepositories.recent(), localStorage.length]).toEqual([["Sites"], ["/a"], 0]);
  });
});

describe("GitRecentRepositories", () => {
  const fresh = (): void => {
    localStorage.clear();
    GitRecentRepositories.restore();
    onTestFinished(() => {
      localStorage.clear();
      GitRecentRepositories.restore();
    });
  };

  it("puts the folder opened last first, keeps twenty, and forgets folders on request", () => {
    fresh();
    for (let i = 1; i <= 21; i++)
      GitRecentRepositories.remember(`/r${i}`);
    GitRecentRepositories.remember("/r5");
    GitRecentRepositories.forget(new Set(["/r21", "/r20"]));

    expect(GitRecentRepositories.recent().slice(0, 3)).toEqual(["/r5", "/r19", "/r18"]);
    expect([GitRecentRepositories.recent().length, GitRecentRepositories.recent().at(-1)]).toEqual([18, "/r2"]);
    expect(JSON.parse(localStorage.getItem("git.recentRepositories") ?? "[]")).toEqual(GitRecentRepositories.recent());
  });

  it("reads the folders kept, skipping anything that isn't one", () => {
    fresh();
    localStorage.setItem("git.recentRepositories", JSON.stringify(["/a", 3, null, "/b"]));

    GitRecentRepositories.restore();

    expect(GitRecentRepositories.recent()).toEqual(["/a", "/b"]);
  });

  it("names a repository by its folder's last name on any system", () => {
    expect([GitRecentRepositories.nameOf("/work/site/"), GitRecentRepositories.nameOf("C:\\Repos\\app"), GitRecentRepositories.nameOf("site")]).toEqual(["site", "app", "site"]);
  });
});
