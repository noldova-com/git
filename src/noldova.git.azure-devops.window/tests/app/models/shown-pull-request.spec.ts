/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { CheckState, HostChanges, HostCheck, HostItem, HostReference, ReferenceKind, ReferenceState } from "@noldova/git.hosting.protocol";
import { describe, expect, it } from "vitest";

import { ShownPullRequest } from "../../../src/app/models/shown-pull-request.ts";

describe("ShownPullRequest", () => {
  it("holds the pull request and its checks in the order given", () => {
    const pullRequest = new HostItem(new HostReference("git-azure-devops", "fabrikam", "3f2504e0-4f89-11d3-9a0c-0305e82c3301", 7), ReferenceKind.PullRequest,
      ReferenceState.Open, "Sample pull request title", "https://dev.azure.com/fabrikam/web/_git/site/pullrequest/7", null, 1_800_000_000_000, null, 0,
      HostChanges.uncounted("feature/readme", "main", "0123456789abcdef0123456789abcdef01234567"));
    const checks = [new HostCheck("Windows x64", CheckState.Failed, null), new HostCheck("Linux x64", CheckState.Succeeded, null)];

    const shown = new ShownPullRequest(pullRequest, checks);

    expect([shown.pullRequest, shown.checks]).toEqual([pullRequest, checks]);
  });
});
