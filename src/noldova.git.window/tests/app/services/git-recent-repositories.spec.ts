/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { describe, expect, it, onTestFinished } from "vitest";

import { GitRecentRepositories } from "../../../src/app/services/git-recent-repositories.ts";

describe("GitRecentRepositories", () => {
  const key: string = "git.recentRepositories";
  const start = (kept: string | null): void => {
    onTestFinished(() => {
      localStorage.removeItem(key);
      GitRecentRepositories.restore();
    });
    if (kept === null)
      localStorage.removeItem(key);
    else
      localStorage.setItem(key, kept);
    GitRecentRepositories.restore();
  };

  it("restores the kept list's folders, newest first, and drops what isn't a folder", () => {
    start("[\"/work/b\", 7, null, \"/work/a\", {\"folder\": \"/work/c\"}]");

    expect(GitRecentRepositories.recent()).toEqual(["/work/b", "/work/a"]);
  });

  it("starts empty when nothing is kept", () => {
    start(null);

    expect(GitRecentRepositories.recent()).toEqual([]);
  });

  it("puts a remembered folder first, once, and keeps the list in storage", () => {
    start("[\"/work/b\", \"/work/a\"]");

    GitRecentRepositories.remember("/work/c");
    GitRecentRepositories.remember("/work/a");

    expect([GitRecentRepositories.recent(), localStorage.getItem(key)]).toEqual([["/work/a", "/work/c", "/work/b"], "[\"/work/a\",\"/work/c\",\"/work/b\"]"]);
  });

  it("keeps the newest twenty, dropping the oldest", () => {
    start(JSON.stringify(Array.from({ length: 20 }, (_, i) => `/work/${i}`)));

    GitRecentRepositories.remember("/work/new");

    expect([GitRecentRepositories.recent().length, GitRecentRepositories.recent()[0], GitRecentRepositories.recent()[19], GitRecentRepositories.recent().includes("/work/19")])
      .toEqual([20, "/work/new", "/work/18", false]);
  });

  it("forgets the given folders, keeps the rest in order, and keeps the list in storage", () => {
    start("[\"/work/c\", \"/work/b\", \"/work/a\"]");

    GitRecentRepositories.forget(new Set(["/work/b", "/work/x"]));

    expect([GitRecentRepositories.recent(), localStorage.getItem(key)]).toEqual([["/work/c", "/work/a"], "[\"/work/c\",\"/work/a\"]"]);
  });

  it.each([
    ["/work/project", "project"],
    ["/work/project/", "project"],
    ["C:\\work\\project", "project"],
    ["/", "History"]
  ])("names the folder %j by %j", (folder, name) => {
    expect(GitRecentRepositories.nameOf(folder)).toBe(name);
  });
});
