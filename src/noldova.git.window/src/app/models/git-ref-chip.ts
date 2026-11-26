/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { type GitRef, RefKind } from "@noldova/git.protocol";

import { Resources } from "../../resources.ts";
import { GitChipSplit } from "./git-chip-split.ts";

export class GitRefChip {
  public readonly name: string;
  public readonly icon: string;
  public readonly isTag: boolean;
  public readonly isCurrent: boolean;
  public readonly branch: string | null;
  public readonly remotes: readonly string[];

  public constructor(name: string, icon: string, isTag: boolean, isCurrent: boolean, branch: string | null = null, remotes: readonly string[] = []) {
    this.name = name;
    this.icon = icon;
    this.isTag = isTag;
    this.isCurrent = isCurrent;
    this.branch = branch;
    this.remotes = remotes;
  }

  public get isLocalBranch(): boolean {
    return !Object.isNull(this.branch) && this.icon === Resources.localBranchIcon;
  }

  public branchOn(remote: string, labels: readonly GitRefChip[]): string | null {
    if (this.isLocalBranch)
      return labels.some(t => t.branch === remote + Resources.slash + this.name) ? this.name : null;
    return this.nameOn(remote);
  }

  public baseOn(remote: string): string | null {
    return this.isLocalBranch ? this.name : this.nameOn(remote);
  }

  public get title(): string {
    return [this.branch ?? this.name, ...this.remotes.map(t => t + Resources.slash + this.name)].join(Resources.listSeparator);
  }

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

  public static remotesApart(chips: readonly GitRefChip[]): GitRefChip[] {
    return chips.flatMap(chip => chip.remotes.length === 0 ? [chip] : [
      new GitRefChip(chip.name, chip.icon, chip.isTag, chip.isCurrent, chip.branch),
      ...chip.remotes.map(t => new GitRefChip(t, Resources.remoteBranchIcon, false, false, t + Resources.slash + chip.name))
    ]);
  }

  private nameOn(remote: string): string | null {
    const prefix: string = remote + Resources.slash;
    return !Object.isNull(this.branch) && this.branch.startsWith(prefix) && this.branch.length > prefix.length ? this.branch.slice(prefix.length) : null;
  }

  public static split(chips: readonly GitRefChip[], limit: number): GitChipSplit {
    return chips.length > limit ? new GitChipSplit(chips.slice(0, limit), chips.slice(limit)) : new GitChipSplit(chips, []);
  }
}
