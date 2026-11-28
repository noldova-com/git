/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { DiffScopeKind, OperationKind } from "@noldova/git.protocol";
import { describe, expect, it } from "vitest";

import { GitFileGroupKind } from "../src/app/enums/git-file-group-kind.ts";
import { Resources } from "../src/resources.ts";

describe("Resources", () => {
  it("names the counts each button and hint carries, in the singular and the plural", () => {
    expect([Resources.formatPush(0), Resources.formatPush(2), Resources.formatPull(0), Resources.formatPull(1)]).toEqual(["Push", "Push 2", "Pull", "Pull 1"]);
    expect([Resources.formatCommit(1), Resources.formatCommit(2)]).toEqual(["Commit 1 file", "Commit 2 files"]);
    expect([Resources.formatStageLines(1), Resources.formatStageLines(3), Resources.formatUnstageLines(1), Resources.formatUnstageLines(2)])
      .toEqual(["Stage 1 line", "Stage 3 lines", "Unstage 1 line", "Unstage 2 lines"]);
    expect([Resources.formatConflictHint(1, OperationKind.Merge), Resources.formatConflictHint(2, OperationKind.CherryPick)])
      .toEqual(["Resolve the one conflicted file to commit the merge.", "Resolve the two conflicted files to commit the cherry-pick."]);
    expect([Resources.formatConflictText(0), Resources.formatConflictText(1), Resources.formatConflictText(2)]).toEqual([
      "Every conflict is resolved. Commit to finish.",
      "One file has conflicts. Resolve it, or abort.",
      "Two files have conflicts. Resolve them, or abort."
    ]);
    expect([Resources.formatOperationReady(OperationKind.Rebase), Resources.formatOperationReady(OperationKind.Merge)]).toEqual([
      "Nothing is in conflict. Continue the rebase when you're ready.", "Nothing is in conflict. Commit the merge when you're ready."
    ]);
  });

  it("writes a count in a sentence or button as a word from one to nine and in digits otherwise, capitalized where it starts a sentence", () => {
    expect([0, 1, 9, 10, 12].map(t => Resources.formatCount(t))).toEqual(["0", "one", "nine", "10", "12"]);
    expect([1, 3, 12].map(t => Resources.formatCountStart(t))).toEqual(["One", "Three", "12"]);
  });

  it("names an operation with or without the branch it comes from, into the branch checked out or this branch when HEAD is detached, and a hunk with or without its header", () => {
    expect([Resources.formatOperation("Merging", "main", "feature"), Resources.formatOperation("Merging", "main", null), Resources.formatOperation("Rebasing", null, "feature")])
      .toEqual(["Merging main into feature", "Merging main into this branch", "Rebasing into feature"]);
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
    expect(Resources.formatSigningFailed("x")).toBe("The Git view couldn't read how commits are signed: x");
    expect(Resources.signingNotes).toEqual({ OpenPgp: "Signed with a GPG key", Ssh: "Signed with SSH key", X509: "Signed with an X.509 certificate" });
    expect(Resources.formatWatchFailed("x")).toBe("Changes made outside the Git view aren't followed, since the folder couldn't be watched: x");
    expect(Resources.formatUnwatchFailed("/work/a", "x")).toBe("The Git view couldn't stop watching /work/a: x");
  });

  it("writes the switch label, the branch option ids, and the row and diff keys", () => {
    expect(Resources.formatSwitchBranch("main")).toBe("Switch or create a branch, main");
    expect([Resources.formatBranchOptionId(0), Resources.formatBranchOptionId(12)]).toEqual(["git-branch-option-0", "git-branch-option-12"]);
    expect(Resources.formatRowKey(GitFileGroupKind.Staged, "a/b.ts")).toBe("Staged:a/b.ts");
    expect(Resources.formatDiffKey("f1", DiffScopeKind.Worktree)).toBe("f1:Worktree");
  });

  it("writes the ahead and behind counts, the history title of a folder or of a bare root, the changed-file counts and a move's source", () => {
    expect([Resources.formatAhead(2), Resources.formatBehind(3)]).toEqual(["↑2", "↓3"]);
    expect([Resources.formatHistoryTitle("D:\\work\\project\\"), Resources.formatHistoryTitle("/work/app"), Resources.formatHistoryTitle("/")])
      .toEqual(["project", "app", Resources.historyTitleFallback]);
    expect([Resources.formatChangedFiles(1), Resources.formatChangedFiles(2), Resources.formatFilesChanged(1), Resources.formatFilesChanged(4)])
      .toEqual(["1 changed file", "2 changed files", "1 file changed", "4 files changed"]);
    expect(Resources.formatMovedFrom("old.ts")).toBe(" from old.ts");
  });

  it("writes the rebase summary in the singular and the plural", () => {
    expect([Resources.formatStackedFollow(["a"]), Resources.formatStackedFollow(["a", "b"])]).toEqual(["a follows", "a, b follow"]);
    expect([Resources.formatCommitsBecome(1, 1), Resources.formatCommitsBecome(3, 2)]).toEqual(["1 commit becomes 1", "3 commits become 2"]);
    expect([Resources.formatCommitsFrom(1, "main"), Resources.formatCommitsFrom(2, "main")]).toEqual(["1 commit from main", "2 commits from main"]);
    expect([Resources.formatAheadOfBase(1), Resources.formatAheadOfBase(2)]).toEqual(["1 commit ahead of the base", "2 commits ahead of the base"]);
    expect([Resources.formatStepStopsNote(["a.ts"], "main", "ccccccc"), Resources.formatStepStopsNote(["a.ts", "b.ts"], "main", "ccccccc")].map(t => t.split(". You ")[0]))
      .toEqual(["a.ts changed on main. The same lines change in ccccccc", "a.ts, b.ts changed on main. The same lines change in ccccccc"]);
  });

  it("notes a commit's pull request's approvals, then its failing, running or passed checks, leaving out what it has none of", () => {
    expect([[0, 0, 0, 0], [1, 0, 0, 0], [2, 6, 0, 0], [0, 3, 1, 2], [0, 1, 0, 1]].map(([approvals = 0, passed = 0, failing = 0, pending = 0]) =>
      Resources.formatCommitPullRequestNote(approvals, passed, failing, pending))).toEqual([
      "", "1 approval", "2 approvals · 6 of 6 checks passed", "1 of 6 checks failed", "1 of 2 checks running"
    ]);
  });

  it("writes a pull request commit's age in minutes, hours or days, at least a minute, and gives none past 30 days", () => {
    expect([0, 59 * 60_000, 60 * 60_000, 24 * 3_600_000 - 1, 24 * 3_600_000, 30 * 86_400_000, 31 * 86_400_000].map(t => Resources.formatPullRequestCommitAge(t)))
      .toEqual(["1 min", "59 min", "1 h", "23 h", "1 d", "30 d", null]);
  });
});
