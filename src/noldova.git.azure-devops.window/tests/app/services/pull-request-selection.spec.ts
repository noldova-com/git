/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { FakeWindowPartContext } from "@noldova/desktop.window/testing";
import { HostChanges, HostItem, HostPerson, HostPullRequest, HostReference, ReferenceKind, ReferenceState } from "@noldova/git.hosting.protocol";
import { describe, expect, it } from "vitest";

import { PullRequestChoice } from "../../../src/app/models/pull-request-choice.ts";
import { PullRequestSelection } from "../../../src/app/services/pull-request-selection.ts";

describe("PullRequestSelection", () => {
  const reference: HostReference = new HostReference("git-azure-devops", "fabrikam", "site", 482);
  const pullRequest: HostPullRequest = new HostPullRequest(new HostItem(reference, ReferenceKind.PullRequest, ReferenceState.Open, "Export notes",
    "https://dev.azure.com/fabrikam/Web%20Site/_git/site/pullrequest/482", new HostPerson("monalisa@fabrikam.com", null, null), Date.UTC(2026, 10, 20), null, 0,
    new HostChanges(null, null, null, "export-notes", "main", "0123456789abcdef0123456789abcdef01234567")), [], [], [], false, "", 1, []);

  it("keeps one Pull request view per window", () => {
    const context = new FakeWindowPartContext();

    expect([PullRequestSelection.of(context) === PullRequestSelection.of(context), PullRequestSelection.of(context) === PullRequestSelection.of(new FakeWindowPartContext())])
      .toEqual([true, false]);
  });

  it("opens the Pull request view's one instance, titled for the pull request", () => {
    const context = new FakeWindowPartContext();
    PullRequestSelection.of(context).showOnce(new PullRequestChoice(pullRequest, pullRequest.reviewers, 0, { changed: () => undefined, added: () => undefined }));

    expect([context.callsOf("openView"), context.callsOf("showView")]).toEqual([[["git-azure-devops.pullRequestDetail", "selected", "Pull request !482"]], []]);
  });
});
