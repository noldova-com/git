/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { GitBranches } from "@noldova/git.protocol";
import { describe, expect, it } from "vitest";

import { GitBranchMenuKind } from "../../../src/app/enums/git-branch-menu-kind.ts";
import { GitBranchMenuItem } from "../../../src/app/models/git-branch-menu-item.ts";

describe("GitBranchMenuItem", () => {
  const branches: GitBranches = new GitBranches("main", ["main", "Feature/View"], ["origin", "up/stream"], ["origin/main", "up/stream/feature/view", "mirror/feature/x"]);
  const rowsOf = (query: string): readonly string[] => GitBranchMenuItem.itemsOf(branches, query).map(t => `${t.kind}|${t.name}|${t.title}|${t.isCurrent}`);

  it("lists nothing before the branches load", () => {
    expect(GitBranchMenuItem.itemsOf(null, "")).toEqual([]);
  });

  it("offers to create a branch, then the local branches with the current one marked, then the remote ones, which switch by their local name", () => {
    expect(rowsOf("")).toEqual([
      `${GitBranchMenuKind.Create}||Create branch from here…|false`,
      `${GitBranchMenuKind.Local}|main|main|true`,
      `${GitBranchMenuKind.Local}|Feature/View|Feature/View|false`,
      `${GitBranchMenuKind.Remote}|main|origin/main|false`,
      `${GitBranchMenuKind.Remote}|feature/view|up/stream/feature/view|false`,
      `${GitBranchMenuKind.Remote}|mirror/feature/x|mirror/feature/x|false`
    ]);
  });

  it("filters by the typed text in any case, and offers no create row for a local branch's exact name", () => {
    expect(rowsOf("feature/view")).toEqual([
      `${GitBranchMenuKind.Create}|feature/view|Create branch feature/view|false`,
      `${GitBranchMenuKind.Local}|Feature/View|Feature/View|false`,
      `${GitBranchMenuKind.Remote}|feature/view|up/stream/feature/view|false`
    ]);
    expect(rowsOf("main")).toEqual([`${GitBranchMenuKind.Local}|main|main|true`, `${GitBranchMenuKind.Remote}|main|origin/main|false`]);
  });
});
