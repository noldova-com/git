/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { CheckState, HostChanges, HostCheck, HostItem, HostReference, ReferenceKind, ReferenceState } from "@noldova/git.hosting.protocol";
import { describe, expect, it } from "vitest";

import { GitHubLook } from "../../../src/app/models/github-look.ts";
import { GitHubLookColor } from "../../../src/app/models/github-look-color.ts";
import { ShownPullRequest } from "../../../src/app/models/shown-pull-request.ts";

describe("ShownPullRequest", () => {
  it("holds the pull request, its look and its checks in the order given", () => {
    const pullRequest = new HostItem(new HostReference("git-github", "example-owner", "example-repository", 7), ReferenceKind.PullRequest, ReferenceState.Open,
      "Sample pull request title", "https://github.com/example-owner/example-repository/pull/7", null, 1_800_000_000_000, null, 0,
      new HostChanges(1, 0, 1, "feature/readme", "main", "0123456789abcdef0123456789abcdef01234567"));
    const color = new GitHubLookColor("var(--nol-status-ok)", "color-mix(in srgb, var(--nol-status-ok) 16%, transparent)");
    const look = new GitHubLook("Pull request", "Open", "data:image/svg+xml,a", color, color);
    const checks = [new HostCheck("Windows x64", CheckState.Failed, null), new HostCheck("Linux x64", CheckState.Succeeded, null)];

    const shown = new ShownPullRequest(pullRequest, look, checks);

    expect([shown.pullRequest, shown.look, shown.checks]).toEqual([pullRequest, look, checks]);
  });
});
