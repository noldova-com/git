/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import type { GitBranches } from "@noldova/git.protocol";

import { GitBranchMenuKind } from "../enums/git-branch-menu-kind.ts";
import { Resources } from "../../resources.ts";

export class GitBranchMenuItem {
  public readonly kind: GitBranchMenuKind;
  public readonly name: string;
  public readonly title: string;
  public readonly isCurrent: boolean;

  public constructor(kind: GitBranchMenuKind, name: string, title: string, isCurrent: boolean) {
    this.kind = kind;
    this.name = name;
    this.title = title;
    this.isCurrent = isCurrent;
  }

  public static itemsOf(branches: GitBranches | null, query: string): readonly GitBranchMenuItem[] {
    if (Object.isNull(branches))
      return [];
    const lower: string = query.toLowerCase();
    const matches = (name: string): boolean => name.toLowerCase().includes(lower);
    const items: GitBranchMenuItem[] = [];
    if (query.length === 0)
      items.push(new GitBranchMenuItem(GitBranchMenuKind.Create, "", Resources.createBranchPrompt, false));
    else if (!branches.branches.includes(query))
      items.push(new GitBranchMenuItem(GitBranchMenuKind.Create, query, Resources.formatCreateBranch(query), false));
    for (const branch of branches.branches.filter(matches))
      items.push(new GitBranchMenuItem(GitBranchMenuKind.Local, branch, branch, branch === branches.current));
    for (const branch of branches.remoteBranches.filter(matches))
      items.push(new GitBranchMenuItem(GitBranchMenuKind.Remote, GitBranchMenuItem.localNameOf(branch, branches.remotes), branch, false));
    return items;
  }

  public static localNameOf(branch: string, remotes: readonly string[]): string {
    const remote: string | undefined = remotes.find(t => branch.startsWith(`${t}${Resources.slash}`));
    return Object.isUndefined(remote) ? branch : branch.slice(remote.length + 1);
  }
}
