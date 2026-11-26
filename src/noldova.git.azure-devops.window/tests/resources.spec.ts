/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { HostPerson } from "@noldova/git.hosting.protocol";
import { describe, expect, it } from "vitest";

import { Resources } from "../src/resources.ts";

describe("The Azure DevOps window part's Resources", () => {
  it("names a failed request, an unreadable event and a link that didn't open, with the reason", () => {
    expect([Resources.formatRequestFailed("git-azure-devops.readSignIn", "Error: No."),
      Resources.formatEventUnread("git-azure-devops.signInChanged", "Error: No."),
      Resources.formatLinkFailed("https://dev.azure.com/_usersSettings/tokens", "Error: No.")])
      .toEqual(["The Azure DevOps module's git-azure-devops.readSignIn request failed: Error: No.",
        "The Azure DevOps module's git-azure-devops.signInChanged event couldn't be read: Error: No.",
        "The Azure DevOps module couldn't open https://dev.azure.com/_usersSettings/tokens: Error: No."]);
  });

  it("says the account is signed in on this computer, with its name when it has one, and names the account for the Settings search", () => {
    expect([Resources.formatSignedIn("Mona Lisa"), Resources.formatSignedIn(null), Resources.formatAccountNote("monalisa@example.com")])
      .toEqual(["Mona Lisa · signed in on this computer", "Signed in on this computer", "Signed in on this computer as monalisa@example.com"]);
  });

  it("names a person by the name they show, or without one by their login, a group's by its name alone", () => {
    expect([new HostPerson("monalisa@example.com", null, null, undefined, "Mona Lisa"), new HostPerson("monalisa@example.com", null, null),
      new HostPerson("[web]\\Web Team", null, null)].map(t => Resources.formatPersonName(t))).toEqual(["Mona Lisa", "monalisa@example.com", "Web Team"]);
  });

  it("writes a pull request's title after its number, as Azure DevOps marks a pull request", () => {
    expect(Resources.formatPullRequestTitle(7, "Sample pull request title")).toBe("!7 Sample pull request title");
  });

  it("writes a commit's age as the design does, in minutes from the first, then hours, then days, and leaves one past 30 days to its date", () => {
    const minute: number = 60_000;

    expect([0, 59 * minute + 59_999, 60 * minute, 24 * 60 * minute - 1, 24 * 60 * minute, 30 * 24 * 60 * minute + minute, 31 * 24 * 60 * minute, -minute]
      .map(t => Resources.formatCommitAge(t))).toEqual(["1 min", "59 min", "1 h", "23 h", "1 d", "30 d", null, "1 min"]);
  });

  it("counts a work item's commits on its branch in words from one to nine and in digits after", () => {
    expect([1, 5, 9, 12].map(t => Resources.formatBranchCommits(t))).toEqual(["one commit on this branch", "five commits on this branch", "nine commits on this branch",
      "12 commits on this branch"]);
  });
});
