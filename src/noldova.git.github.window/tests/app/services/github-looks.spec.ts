/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ReferenceKind, ReferenceState } from "@noldova/git.hosting.protocol";
import { describe, expect, it } from "vitest";

import { GitHubLook, GitHubLookColor, GitHubLooks } from "../../../src/api/index.ts";
import { Resources } from "../../../src/resources.ts";

const ok: GitHubLookColor = new GitHubLookColor("var(--nol-status-ok)", "color-mix(in srgb, var(--nol-status-ok) 16%, transparent)");
const muted: GitHubLookColor = new GitHubLookColor("var(--nol-text-muted)", "color-mix(in srgb, var(--nol-text-muted) 16%, transparent)");
const failed: GitHubLookColor = new GitHubLookColor("var(--nol-status-failed)", "color-mix(in srgb, var(--nol-status-failed) 14%, transparent)");
const purpleLight: GitHubLookColor = new GitHubLookColor("#8250DF", "color-mix(in srgb, #8250DF 14%, transparent)");
const purpleDark: GitHubLookColor = new GitHubLookColor("#A371F7", "color-mix(in srgb, #A371F7 18%, transparent)");

function svgOf(image: string): string {
  expect(image.startsWith("data:image/svg+xml,")).toBe(true);
  return decodeURIComponent(image.slice("data:image/svg+xml,".length));
}

describe("GitHubLooks", () => {
  it("gives each pull request and issue state GitHub's words, its Octicon and the design's colors in light and dark", () => {
    const cases: readonly (readonly [ReferenceKind, ReferenceState, string, string, string, GitHubLookColor, GitHubLookColor])[] = [
      [ReferenceKind.PullRequest, ReferenceState.Open, "Pull request", "Open", Resources.pullRequestOcticon, ok, ok],
      [ReferenceKind.PullRequest, ReferenceState.Draft, "Pull request", "Draft", Resources.pullRequestDraftOcticon, muted, muted],
      [ReferenceKind.PullRequest, ReferenceState.Merged, "Pull request", "Merged", Resources.mergedOcticon, purpleLight, purpleDark],
      [ReferenceKind.PullRequest, ReferenceState.Closed, "Pull request", "Closed", Resources.pullRequestClosedOcticon, failed, failed],
      [ReferenceKind.Issue, ReferenceState.Open, "Issue", "Open", Resources.issueOpenedOcticon, ok, ok],
      [ReferenceKind.Issue, ReferenceState.ClosedDone, "Issue", "Closed", Resources.issueClosedOcticon, purpleLight, purpleDark],
      [ReferenceKind.Issue, ReferenceState.ClosedNotPlanned, "Issue", "Closed", Resources.notPlannedOcticon, muted, muted]
    ];

    for (const [kind, state, kindLabel, stateLabel, icon, light, dark] of cases) {
      const look: GitHubLook | null = GitHubLooks.of(kind, state);
      expect(look, `${kind} ${state}`).toBeInstanceOf(GitHubLook);
      expect([look?.kindLabel, look?.stateLabel, svgOf(look?.icon ?? ""), look?.light, look?.dark], `${kind} ${state}`)
        .toEqual([kindLabel, stateLabel, icon, light, dark]);
    }
  });

  it("has no look for a state the kind doesn't have", () => {
    const missing = [[ReferenceKind.Issue, ReferenceState.Merged], [ReferenceKind.Issue, ReferenceState.Draft], [ReferenceKind.Issue, ReferenceState.Closed],
      [ReferenceKind.PullRequest, ReferenceState.ClosedDone], [ReferenceKind.PullRequest, ReferenceState.ClosedNotPlanned]] as const;

    expect(missing.map(([kind, state]) => GitHubLooks.of(kind, state))).toEqual([null, null, null, null, null]);
  });

  it("gives GitHub's mark and the Octicons as 16px monochrome SVG images with nothing but paths", () => {
    const images: readonly string[] = [GitHubLooks.mark, ...Object.values(ReferenceKind).flatMap(kind => Object.values(ReferenceState)
      .map(state => GitHubLooks.of(kind, state)?.icon ?? "")).filter(t => t.length > 0)];

    expect(svgOf(GitHubLooks.mark)).toBe(Resources.markOcticon);
    expect(images).toHaveLength(8);
    for (const image of images) {
      const svg: Document = new DOMParser().parseFromString(svgOf(image), "image/svg+xml");
      const root: Element = svg.documentElement;
      expect([root.tagName, root.getAttribute("viewBox"), root.getAttribute("fill"), [...root.children].map(t => t.tagName)])
        .toEqual(["svg", "0 0 16 16", null, [...root.children].map(() => "path")]);
      expect(root.children.length).toBeGreaterThan(0);
    }
  });
});
