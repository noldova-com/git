/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { describe, expect, it, onTestFinished, vi } from "vitest";

import { GitRebaseTarget, GitRebasing } from "../../../src/app/services/git-rebasing.ts";

describe("GitRebasing", () => {
  const fresh = (): void => {
    localStorage.clear();
    GitRebasing.restore();
    onTestFinished(() => {
      vi.restoreAllMocks();
      localStorage.clear();
      GitRebasing.restore();
    });
  };

  const stored = (): unknown => JSON.parse(localStorage.getItem("git.rebaseTargets") ?? "null");

  it("keeps each folder's target in the window's storage, so a rebase screen restored after a restart still has it", () => {
    fresh();
    GitRebasing.open("/work/a", new GitRebaseTarget("a".repeat(40), "main"));
    GitRebasing.open("/work/b", new GitRebaseTarget("b".repeat(40), "bbbbbbb"));
    GitRebasing.open("/work/a", new GitRebaseTarget("c".repeat(40), "origin/main"));
    GitRebasing.forget("/work/b");
    GitRebasing.targets.set(new Map());

    GitRebasing.restore();

    expect([GitRebasing.targetOf("/work/a"), GitRebasing.targetOf("/work/b")]).toEqual([new GitRebaseTarget("c".repeat(40), "origin/main"), null]);
    expect(stored()).toEqual([{ folder: "/work/a", id: "c".repeat(40), name: "origin/main" }]);
  });

  it("drops a kept target that no longer reads, and starts with none when what's kept doesn't read as a list", () => {
    fresh();
    localStorage.setItem("git.rebaseTargets", JSON.stringify([{ folder: "/work/a", id: "a".repeat(40), name: "main" }, { folder: "/work/b", id: "" }, "x"]));
    GitRebasing.restore();
    const kept: readonly string[] = [...GitRebasing.targets().keys()];
    localStorage.setItem("git.rebaseTargets", "{\"folder\":\"/work/a\"}");
    GitRebasing.restore();

    expect([kept, GitRebasing.targets().size]).toEqual([["/work/a"], 0]);
  });

  it("keeps a target for the window's life when storage can't keep it", () => {
    fresh();
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new DOMException("Storage is full.", "QuotaExceededError");
    });

    GitRebasing.open("/work/a", new GitRebaseTarget("a".repeat(40), "main"));

    expect([GitRebasing.targetOf("/work/a")?.name, localStorage.length]).toEqual(["main", 0]);
  });
});
