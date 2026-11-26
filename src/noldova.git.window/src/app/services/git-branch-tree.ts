/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";

import { GitBranchRow } from "../models/git-branch-row.ts";
import { GitBranchTreeNode } from "../models/git-branch-tree-node.ts";

export class GitBranchTree {
  private static readonly SEPARATOR: string = "/";

  public static localRowsOf(prefix: string, branches: readonly string[], opened: ReadonlySet<string>): GitBranchRow[] {
    const rows: GitBranchRow[] = [];
    GitBranchTree.addLevel(rows, prefix, "", branches, 1, opened);
    return rows;
  }

  public static remoteRowsOf(remotes: readonly string[], remoteBranches: readonly string[], opened: ReadonlySet<string>): GitBranchRow[] {
    const rows: GitBranchRow[] = [];
    for (const remote of remotes) {
      const prefix: string = remote + GitBranchTree.SEPARATOR;
      const names: string[] = remoteBranches.filter(t => t.startsWith(prefix)).map(t => t.slice(prefix.length));
      rows.push(new GitBranchRow(prefix, remote, 1, true, names.length, ""));
      if (opened.has(prefix))
        GitBranchTree.addLevel(rows, prefix, prefix, names, 2, opened);
    }
    return rows;
  }

  private static addLevel(rows: GitBranchRow[], key: string, branch: string, names: readonly string[], depth: number, opened: ReadonlySet<string>): void {
    const folders: Map<string, string[]> = new Map();
    const branches: string[] = [];
    for (const name of names) {
      const at: number = name.indexOf(GitBranchTree.SEPARATOR);
      if (at < 0)
        branches.push(name);
      else
        folders.set(name.slice(0, at), [...folders.get(name.slice(0, at)) ?? [], name.slice(at + 1)]);
    }
    const entries: GitBranchTreeNode[] = [...[...folders].map(([name, children]) => new GitBranchTreeNode(name, children)), ...branches.map(t => new GitBranchTreeNode(t, null))]
      .sort((a, b) => Number(!Object.isNull(b.children)) - Number(!Object.isNull(a.children)) || a.name.localeCompare(b.name, undefined, { sensitivity: "base" }));
    for (const { name, children } of entries) {
      const isFolder: boolean = !Object.isNull(children);
      const folder: string = isFolder ? GitBranchTree.SEPARATOR : "";
      rows.push(new GitBranchRow(key + name + folder, name, depth, isFolder, 0, isFolder ? "" : branch + name));
      if (!Object.isNull(children) && opened.has(key + name + folder))
        GitBranchTree.addLevel(rows, key + name + folder, branch + name + folder, children, depth + 1, opened);
    }
  }
}
