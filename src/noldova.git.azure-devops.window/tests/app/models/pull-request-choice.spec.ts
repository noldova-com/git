/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { HostChanges, HostItem, HostPerson, HostPullRequest, HostReference, HostReviewer, ReferenceKind, ReferenceState } from "@noldova/git.hosting.protocol";
import { describe, expect, it } from "vitest";

import { PullRequestChoice } from "../../../src/app/models/pull-request-choice.ts";

describe("PullRequestChoice", () => {
  it("keeps the pull request shown, its reviewers, when it was read and the page's actions, which it calls back as they were given", () => {
    const reference: HostReference = new HostReference("git-azure-devops", "fabrikam", "site", 752);
    const pullRequest: HostPullRequest = new HostPullRequest(new HostItem(reference, ReferenceKind.PullRequest, ReferenceState.Open, "Export notes",
      "https://dev.azure.com/fabrikam/web/_git/site/pullrequest/752", null, 1, null, 0,
      HostChanges.uncounted("users/kim/export-notes", "main", "0123456789abcdef0123456789abcdef01234567")), [], [], [], false, "", null, []);
    const reviewer: HostReviewer = new HostReviewer(new HostPerson("octocat@fabrikam.test", null, null), 1, "Approved", true);
    const calls: unknown[] = [];
    const choice: PullRequestChoice = new PullRequestChoice(pullRequest, [reviewer], 1_700_000_000_000,
      { changed: t => calls.push(["changed", t]), added: t => calls.push(["added", t.person.login]) });

    choice.actions.changed(null);
    choice.actions.added(reviewer);

    expect([choice.pullRequest, choice.reviewers, choice.readAt, calls]).toEqual([pullRequest, [reviewer], 1_700_000_000_000,
      [["changed", null], ["added", "octocat@fabrikam.test"]]]);
  });
});
