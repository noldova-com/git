/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { type GitRef, RefKind } from "@noldova/git.protocol";

import { Resources } from "../../resources.ts";

/**
 * A label on a commit: a local branch, with the remotes that hold the same branch on the same commit as marks on it,
 * a remote branch, a tag or a detached HEAD.
 */
export class GitRefChip {
  public readonly name: string;
  public readonly icon: string;
  public readonly isTag: boolean;
  public readonly isCurrent: boolean;
  /** The branch's whole name, local or remote, which a drag carries; `null` for a tag or a detached HEAD, which don't drag. */
  public readonly branch: string | null;
  /** The remotes that hold a local branch on the same commit, such as `origin`; empty for any other label. */
  public readonly remotes: readonly string[];

  public constructor(name: string, icon: string, isTag: boolean, isCurrent: boolean, branch: string | null = null, remotes: readonly string[] = []) {
    this.name = name;
    this.icon = icon;
    this.isTag = isTag;
    this.isCurrent = isCurrent;
    this.branch = branch;
    this.remotes = remotes;
  }

  /** Whether the label is a local branch, which a switch can make current. */
  public get isLocalBranch(): boolean {
    return this.branch !== null && this.icon === Resources.localBranchIcon;
  }

  /**
   * The branch's name on `remote` where the commit's `labels` show that remote holding it here: a local branch beside the remote's own label for it,
   * or the remote's own branch; `null` otherwise.
   */
  public branchOn(remote: string, labels: readonly GitRefChip[]): string | null {
    if (this.isLocalBranch)
      return labels.some(t => t.branch === remote + Resources.slash + this.name) ? this.name : null;
    return this.nameOn(remote);
  }

  /** The branch a pull request into this label goes into on `remote`: a local branch's own name, or the remote's own branch; `null` otherwise. */
  public baseOn(remote: string): string | null {
    return this.isLocalBranch ? this.name : this.nameOn(remote);
  }

  /** The label's whole name, with the remote branches it stands for, such as `main, origin/main`; a remote's own chip beside its branch names the remote branch. */
  public get title(): string {
    return [this.branch ?? this.name, ...this.remotes.map(t => t + Resources.slash + this.name)].join(Resources.listSeparator);
  }

  /** Lists a commit's labels: local branches, the current one first, each with the remotes that hold it on this commit; then other remote branches, a detached HEAD and tags. */
  public static chipsOf(refs: readonly GitRef[]): GitRefChip[] {
    const current: string | null = refs.find(t => t.kind === RefKind.Head)?.name ?? null;
    const locals: string[] = refs.filter(t => t.kind === RefKind.Branch).map(t => t.name).sort((a, b) => Number(b === current) - Number(a === current));
    const remotes: string[] = refs.filter(t => t.kind === RefKind.RemoteBranch).map(t => t.name);
    const shown: Set<string> = new Set<string>();
    const chips: GitRefChip[] = [];
    for (const local of locals) {
      const held: string[] = remotes.filter(t => t.endsWith(Resources.slash + local) && t.length > local.length + 1);
      held.forEach(t => shown.add(t));
      chips.push(new GitRefChip(local, Resources.localBranchIcon, false, local === current, local, held.map(t => t.slice(0, -local.length - 1))));
    }
    for (const remote of remotes)
      if (!shown.has(remote))
        chips.push(new GitRefChip(remote, Resources.remoteBranchIcon, false, false, remote));
    if (current === "")
      chips.push(new GitRefChip(Resources.headRevision, Resources.detachedHeadIcon, false, true));
    for (const tag of refs.filter(t => t.kind === RefKind.Tag))
      chips.push(new GitRefChip(tag.name, Resources.tagIcon, true, false));
    return chips;
  }

  /** Lists the labels with each remote that holds a local branch on the same commit as its own chip right after that branch, such as `main` then `origin`. */
  public static remotesApart(chips: readonly GitRefChip[]): GitRefChip[] {
    return chips.flatMap(chip => chip.remotes.length === 0 ? [chip] : [
      new GitRefChip(chip.name, chip.icon, chip.isTag, chip.isCurrent, chip.branch),
      ...chip.remotes.map(t => new GitRefChip(t, Resources.remoteBranchIcon, false, false, t + Resources.slash + chip.name))
    ]);
  }

  /** A remote branch's name on `remote`, without the remote's name; `null` for any other label. */
  private nameOn(remote: string): string | null {
    const prefix: string = remote + Resources.slash;
    return this.branch !== null && this.branch.startsWith(prefix) && this.branch.length > prefix.length ? this.branch.slice(prefix.length) : null;
  }

  /** Splits a row's labels into those it shows and those its `+N` label lists, so that a row shows at most `limit` and the `+N` one. */
  public static split(chips: readonly GitRefChip[], limit: number): readonly [readonly GitRefChip[], readonly GitRefChip[]] {
    return chips.length > limit ? [chips.slice(0, limit), chips.slice(limit)] : [chips, []];
  }
}
