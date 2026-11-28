/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";

import { ToolFailureCode, ToolRisk } from "@noldova/desktop.runtime";
import { describe, it } from "vitest";

import { FakeGitHub } from "../fixtures/fake-github.fixture.ts";
import { HEAD } from "../fixtures/fake-tools.fixture.ts";
import { failureOf, folder, PrToolsRig, pull, textOf } from "../fixtures/pr-tools.fixture.ts";

describe("GitHubPrChecksTool", () => {
  it("answers the newest pull request of the session's branch, the check runs of its HEAD and its review, as untrusted text from github.com, with the account its origin's user name names", async () => {
    const rig = new PrToolsRig();
    rig.repositories.users.set("origin", "hubot");
    rig.github.answer(FakeGitHub.json([pull]), FakeGitHub.json(pull), FakeGitHub.json({ total_count: 1, check_runs: [{ name: "build", status: "completed",
      conclusion: "success", html_url: null }] }), FakeGitHub.json([{ user: { login: "hubot" }, state: "APPROVED", author_association: "MEMBER" }]));

    const answer = textOf(await rig.checksAsync());

    assert.deepEqual([answer.readObject("pullRequest").readString("title"), answer.readObjectArray("checks").map(t => t.toJson()),
      answer.readString("reviewDecision"), rig.repositories.folders], ["Fix the bug", [{ name: "build", state: "Succeeded", url: null }], "Approved", [folder]]);
    assert.deepEqual(rig.github.urls(), ["https://api.github.com/repos/octocat/hello-world/pulls?head=octocat%3Afix-bug&state=all&per_page=1",
      "https://api.github.com/repos/octocat/hello-world/pulls/2", `https://api.github.com/repos/octocat/hello-world/commits/${HEAD}/check-runs?per_page=100`,
      "https://api.github.com/repos/octocat/hello-world/pulls/2/reviews?per_page=100"]);
    assert.deepEqual([rig.repositories.userReads, rig.token.users], [[[folder, "origin"]], ["github.com octocat/hello-world hubot"]]);
  });

  it("is a low-risk read that reaches GitHub", () => {
    const tool = new PrToolsRig().session.listTools().find(t => t.name === "git_github_pr_checks");

    assert.deepEqual([tool?.hints, tool?.risk, tool?.deadline], [{ isReadOnly: true, isDestructive: false, isOpenWorld: true },
      { default: ToolRisk.Low, maximum: ToolRisk.Low }, { default: 30_000, maximum: 120_000 }]);
  });

  it("fails as signed out when signed out, when GitHub refuses the token or when the sign-in ends while GitHub answers, and as Unavailable when GitHub fails",
    async () => {
      const signedOut = new PrToolsRig(null);
      const refused = new PrToolsRig();
      refused.github.answer(FakeGitHub.json({ message: "Bad credentials" }, 401));
      const failing = new PrToolsRig();
      failing.github.answer(FakeGitHub.json({ message: "Server Error" }, 500));
      const ending = new PrToolsRig();
      const release = ending.github.hold();
      ending.github.answer(FakeGitHub.json(pull), FakeGitHub.json({ total_count: 0, check_runs: [] }), FakeGitHub.json([]));

      const pending = ending.checksAsync();
      await ending.github.askedAsync(1);
      ending.token.answer("token", null);
      release(FakeGitHub.json([pull]));
      const outcomes = [await signedOut.checksAsync(), await refused.checksAsync(), await failing.checksAsync(), await pending];

      assert.deepEqual(outcomes.map(failureOf), [[ToolFailureCode.Unavailable, "git-github.signedOut"], [ToolFailureCode.Unavailable, "git-github.signedOut"],
        [ToolFailureCode.Unavailable, "git-github.unavailable"], [ToolFailureCode.Unavailable, "git-github.signedOut"]]);
      assert.deepEqual([signedOut.github.requests.length, refused.token.refused], [0, ["gho_token"]]);
    });
});
