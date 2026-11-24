/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { GitRef, RefKind } from "@noldova/git.protocol";
import { describe, expect, it } from "vitest";

import { GitRefChip } from "../../../src/app/models/git-ref-chip.ts";

describe("GitRefChip", () => {
  const describeChips = (refs: GitRef[]): string[] => GitRefChip.chipsOf(refs).map(t => `${t.icon} ${t.name}${t.remotes.length > 0 ? ` [${t.remotes.join(",")}]` : ""}${t.isCurrent ? " *" : ""}${t.isTag ? " tag" : ""}`);

  it("puts the current branch first, each local with the remotes holding it here as its marks, then other remotes and tags", () => {
    expect(describeChips([
      new GitRef(RefKind.Branch, "feature"),
      new GitRef(RefKind.Branch, "main"),
      new GitRef(RefKind.RemoteBranch, "origin/main"),
      new GitRef(RefKind.RemoteBranch, "upstream/main"),
      new GitRef(RefKind.RemoteBranch, "origin/other"),
      new GitRef(RefKind.RemoteBranch, "main"),
      new GitRef(RefKind.Head, "main"),
      new GitRef(RefKind.Tag, "v1.0")
    ])).toEqual(["computer main [origin,upstream] *", "computer feature", "cloud origin/other", "cloud main", "sell v1.0 tag"]);
  });

  it("carries each branch's whole name for a drag, and none for a tag or a detached HEAD", () => {
    expect(GitRefChip.chipsOf([
      new GitRef(RefKind.Branch, "main"), new GitRef(RefKind.RemoteBranch, "origin/main"), new GitRef(RefKind.RemoteBranch, "origin/other"),
      new GitRef(RefKind.Head, ""), new GitRef(RefKind.Tag, "v1.0")
    ]).map(t => t.branch)).toEqual(["main", "origin/other", null, null]);
  });

  it("names a branch as a remote names it only where that remote holds it on the commit, and a tag or detached HEAD nowhere", () => {
    const chips: GitRefChip[] = GitRefChip.remotesApart(GitRefChip.chipsOf([
      new GitRef(RefKind.Head, "feature/a"), new GitRef(RefKind.Branch, "feature/a"), new GitRef(RefKind.RemoteBranch, "origin/feature/a"),
      new GitRef(RefKind.Branch, "local"), new GitRef(RefKind.RemoteBranch, "upstream/main"), new GitRef(RefKind.Tag, "v1.0")
    ]));

    expect(chips.map(t => t.branch)).toEqual(["feature/a", "origin/feature/a", "local", "upstream/main", null]);
    expect(["origin", "upstream", "feat"].map(remote => chips.map(t => t.branchOn(remote, chips)))).toEqual([
      ["feature/a", "feature/a", null, null, null], [null, null, null, "main", null], [null, null, null, null, null]
    ]);
    expect(["origin", "upstream"].map(remote => chips.map(t => t.baseOn(remote)))).toEqual([
      ["feature/a", "feature/a", "local", null, null], ["feature/a", null, "local", "main", null]
    ]);
  });

  it("names a branch with the remote branches it stands for in its title, and any other label by its name", () => {
    expect(GitRefChip.chipsOf([
      new GitRef(RefKind.Branch, "main"), new GitRef(RefKind.RemoteBranch, "origin/main"), new GitRef(RefKind.RemoteBranch, "upstream/main"),
      new GitRef(RefKind.RemoteBranch, "origin/other"), new GitRef(RefKind.Tag, "v1.0")
    ]).map(t => t.title)).toEqual(["main, origin/main, upstream/main", "origin/other", "v1.0"]);
  });

  it("sets each remote holding a local branch here apart as its own chip right after the branch, named for the remote and titled and dragged as the remote branch", () => {
    const chips: GitRefChip[] = GitRefChip.remotesApart(GitRefChip.chipsOf([
      new GitRef(RefKind.Head, "main"), new GitRef(RefKind.Branch, "main"), new GitRef(RefKind.RemoteBranch, "origin/main"), new GitRef(RefKind.RemoteBranch, "upstream/main"),
      new GitRef(RefKind.Branch, "feature"), new GitRef(RefKind.RemoteBranch, "origin/other"), new GitRef(RefKind.Tag, "v1.0")
    ]));

    expect(chips.map(t => [t.icon, t.name, t.title, t.branch, t.isCurrent, t.remotes.length])).toEqual([
      ["computer", "main", "main", "main", true, 0], ["cloud", "origin", "origin/main", "origin/main", false, 0], ["cloud", "upstream", "upstream/main", "upstream/main", false, 0],
      ["computer", "feature", "feature", "feature", false, 0], ["cloud", "origin/other", "origin/other", "origin/other", false, 0], ["sell", "v1.0", "v1.0", null, false, 0]
    ]);
  });

  it("keeps a row's labels up to the limit and leaves the rest to its +N label", () => {
    const chips: GitRefChip[] = GitRefChip.chipsOf([new GitRef(RefKind.Branch, "a"), new GitRef(RefKind.Branch, "b"), new GitRef(RefKind.Tag, "c")]);

    expect([GitRefChip.split(chips, 2), GitRefChip.split(chips, 3)].map(([shown, more]) => [shown.map(t => t.name), more.map(t => t.name)]))
      .toEqual([[["a", "b"], ["c"]], [["a", "b", "c"], []]]);
  });

  it("marks a detached HEAD after the branches", () => {
    expect(describeChips([new GitRef(RefKind.RemoteBranch, "origin/main"), new GitRef(RefKind.Head, "")])).toEqual(["cloud origin/main", "adjust HEAD *"]);
  });

  it("shows nothing for a commit without labels", () => {
    expect(GitRefChip.chipsOf([])).toEqual([]);
  });
});
