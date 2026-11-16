/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ReferenceKind, ReferenceState } from "@noldova/git.hosting.protocol";

import { GitHubLook } from "../models/github-look.ts";
import { GitHubLookColor } from "../models/github-look-color.ts";
import { Resources } from "../../resources.ts";

export class GitHubLooks {
  public static readonly mark: string = GitHubLooks.imageOf(Resources.markOcticon);

  private static readonly open: GitHubLookColor = GitHubLooks.colorOf(Resources.openColor, Resources.fillPercent);
  private static readonly muted: GitHubLookColor = GitHubLooks.colorOf(Resources.mutedColor, Resources.fillPercent);
  private static readonly closed: GitHubLookColor = GitHubLooks.colorOf(Resources.closedColor, Resources.closedFillPercent);
  private static readonly doneLight: GitHubLookColor = GitHubLooks.colorOf(Resources.doneLightColor, Resources.doneLightFillPercent);
  private static readonly doneDark: GitHubLookColor = GitHubLooks.colorOf(Resources.doneDarkColor, Resources.doneDarkFillPercent);
  private static readonly looks: ReadonlyMap<string, GitHubLook> = GitHubLooks.lookMap();

  public static of(kind: ReferenceKind, state: ReferenceState): GitHubLook | null {
    return GitHubLooks.looks.get(GitHubLooks.keyOf(kind, state)) ?? null;
  }

  private static lookMap(): ReadonlyMap<string, GitHubLook> {
    const looks: Map<string, GitHubLook> = new Map();
    GitHubLooks.add(looks, ReferenceKind.PullRequest, ReferenceState.Open, Resources.openLabel, Resources.pullRequestOcticon, GitHubLooks.open);
    GitHubLooks.add(looks, ReferenceKind.PullRequest, ReferenceState.Draft, Resources.draftLabel, Resources.pullRequestDraftOcticon, GitHubLooks.muted);
    GitHubLooks.add(looks, ReferenceKind.PullRequest, ReferenceState.Merged, Resources.mergedLabel, Resources.mergedOcticon, GitHubLooks.doneLight, GitHubLooks.doneDark);
    GitHubLooks.add(looks, ReferenceKind.PullRequest, ReferenceState.Closed, Resources.closedLabel, Resources.pullRequestClosedOcticon, GitHubLooks.closed);
    GitHubLooks.add(looks, ReferenceKind.Issue, ReferenceState.Open, Resources.openLabel, Resources.issueOpenedOcticon, GitHubLooks.open);
    GitHubLooks.add(looks, ReferenceKind.Issue, ReferenceState.ClosedDone, Resources.closedLabel, Resources.issueClosedOcticon, GitHubLooks.doneLight, GitHubLooks.doneDark);
    GitHubLooks.add(looks, ReferenceKind.Issue, ReferenceState.ClosedNotPlanned, Resources.closedLabel, Resources.notPlannedOcticon, GitHubLooks.muted);
    return looks;
  }

  private static add(looks: Map<string, GitHubLook>, kind: ReferenceKind, state: ReferenceState, stateLabel: string, icon: string, light: GitHubLookColor,
    dark: GitHubLookColor = light): void {
    const kindLabel: string = kind === ReferenceKind.PullRequest ? Resources.pullRequestLabel : Resources.issueLabel;
    looks.set(GitHubLooks.keyOf(kind, state), new GitHubLook(kindLabel, stateLabel, GitHubLooks.imageOf(icon), light, dark));
  }

  private static keyOf(kind: ReferenceKind, state: ReferenceState): string {
    return Resources.formatLookKey(kind, state);
  }

  private static colorOf(color: string, percent: number): GitHubLookColor {
    return new GitHubLookColor(color, Resources.formatFill(color, percent));
  }

  private static imageOf(svg: string): string {
    return Resources.svgImagePrefix + encodeURIComponent(svg);
  }
}
