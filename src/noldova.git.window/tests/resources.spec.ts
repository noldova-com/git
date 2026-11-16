/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { DiffScopeKind } from "@noldova/git.protocol";
import { describe, expect, it } from "vitest";

import { GitFileGroupKind } from "../src/app/enums/git-file-group-kind.ts";
import { Resources } from "../src/resources.ts";

describe("Resources", () => {
  it("names the counts each button and hint carries, in the singular and the plural", () => {
    expect([Resources.formatPush(0), Resources.formatPush(2), Resources.formatPull(0), Resources.formatPull(1)]).toEqual(["Push", "Push 2", "Pull", "Pull 1"]);
    expect([Resources.formatCommit(1), Resources.formatCommit(2)]).toEqual(["Commit 1 file", "Commit 2 files"]);
    expect([Resources.formatConflictHint(1), Resources.formatConflictHint(2)])
      .toEqual(["Stage the 1 conflicted file to commit the merge.", "Stage the 2 conflicted files to commit the merge."]);
    expect([Resources.formatConflictText(0), Resources.formatConflictText(1), Resources.formatConflictText(2)]).toEqual([
      "Every conflict is resolved. Commit to finish.",
      "1 file has conflicts. Resolve them in your editor, or ask a teammate, then stage them.",
      "2 files have conflicts. Resolve them in your editor, or ask a teammate, then stage them."
    ]);
  });

  it("names an operation with or without the branch it comes from, and a hunk with or without its header", () => {
    expect([Resources.formatOperation("Merging", "main"), Resources.formatOperation("Rebasing", null)])
      .toEqual(["Merging main into this branch", "Rebasing into this branch"]);
    expect([Resources.formatHunk(312, 6, 312, 8, ""), Resources.formatHunk(1, 2, 1, 3, "class A")]).toEqual(["@@ -312,6 +312,8 @@", "@@ -1,2 +1,3 @@ class A"]);
  });

  it("writes the remote, upstream and refusal lines", () => {
    expect(Resources.formatPlainRemote("nas", "nas.home", "SSH")).toBe("nas is a plain Git server (nas.home over SSH): no pull requests or checks to show.");
    expect(Resources.formatAheadBehind(2, 0)).toBe("↑2 ahead · ↓0 behind");
    expect(Resources.formatUpstreamGone("origin/a")).toBe("origin/a is gone from its remote");
    expect(Resources.formatHostRowFailed("x")).toBe("The Git view shows the plain remote line, since a host row's claim failed: x");
    expect([Resources.formatPullHooks(null), Resources.formatPullHooks([]), Resources.formatPullHooks(["post-merge", "reference-transaction"])]).toEqual([
      "Fetches and fast-forwards only, running the repository's hooks",
      "Fetches and fast-forwards only. Hooks that will run: None",
      "Fetches and fast-forwards only. Hooks that will run: post-merge, reference-transaction"
    ]);
    expect(Resources.formatPullHooksFailed("x")).toBe("The Git view couldn't read the hooks a pull runs: x");
    expect(Resources.formatWatchFailed("x")).toBe("Changes made outside the Git view aren't followed, since the folder couldn't be watched: x");
    expect(Resources.formatUnwatchFailed("/work/a", "x")).toBe("The Git view couldn't stop watching /work/a: x");
  });

  it("writes the switch label, the branch option ids, and the row and diff keys", () => {
    expect(Resources.formatSwitchBranch("main")).toBe("Switch or create a branch, main");
    expect([Resources.formatBranchOptionId(0), Resources.formatBranchOptionId(12)]).toEqual(["git-branch-option-0", "git-branch-option-12"]);
    expect(Resources.formatRowKey(GitFileGroupKind.Staged, "a/b.ts")).toBe("Staged:a/b.ts");
    expect(Resources.formatDiffKey("f1", DiffScopeKind.Worktree)).toBe("f1:Worktree");
  });
});
