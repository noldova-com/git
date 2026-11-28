/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { HostAccount } from "@noldova/git.hosting.protocol";
import { describe, expect, it } from "vitest";

import { GitHostCardState } from "../../../src/app/enums/git-host-card-state.ts";
import { GitHostFeature } from "../../../src/app/enums/git-host-feature.ts";
import { GitHostCard } from "../../../src/app/models/git-host-card.ts";

describe("GitHostCard", () => {
  it.each([
    [GitHostCardState.SignedIn, false],
    [GitHostCardState.Waiting, false],
    [GitHostCardState.SignedOut, true],
    [GitHostCardState.Failed, true]
  ])("asks to sign in, rather than showing a chip, when it is %s: %s", (state, asks) => {
    const card: GitHostCard = new GitHostCard("GitHub", "Signed in on this computer", state, "Sign in");

    expect([card.title, card.detail, card.state, card.label, card.asksToSignIn, card.account, card.person]).toEqual(["GitHub", "Signed in on this computer", state, "Sign in",
      asks, null, null]);
  });

  it("keeps the host's id for its account when the host has several, and the account it shows", () => {
    const lee: HostAccount = new HostAccount("lee", null, null, ["repo"]);
    const card: GitHostCard = new GitHostCard("lee", "Signed in on this computer", GitHostCardState.SignedIn, "Signed in", "1", lee);

    expect([card.account, card.person]).toEqual(["1", lee]);
  });

  it("knows each card state and host feature by its own name", () => {
    expect(Object.values(GitHostCardState)).toEqual(["SignedIn", "Waiting", "SignedOut", "Failed"]);
    expect(Object.values(GitHostFeature)).toEqual(["PullRequests", "VotesAndPolicies", "BuildsOnCommits", "WorkItems", "BranchFromItem", "AutoComplete"]);
  });
});
