/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";

import { JsonException } from "@noldova/context.json";
import { HostReference } from "@noldova/git.hosting.protocol";
import { describe, it } from "vitest";

import { PullRequestVote } from "../../src/models/pull-request-vote.ts";

const reference: HostReference = new HostReference("git-azure-devops", "fabrikam", "3411ebc1-d5aa-464f-9615-0b527bc66719", 12);
const vote = { reference: reference.toJson(), vote: 10 };

describe("PullRequestVote", () => {
  it("reads each vote Azure DevOps takes", () => {
    assert.deepEqual([10, 5, 0, -5, -10].map(t => PullRequestVote.fromJson({ ...vote, vote: t })), [10, 5, 0, -5, -10].map(t => new PullRequestVote(reference, t)));
  });

  it("answers null for another vote, or another host's, organization's or repository's reference", () => {
    const others = [new HostReference("git-github", "octocat", "hello-world", 12), new HostReference("git-azure-devops", "fab_rikam", reference.repository, 12),
      new HostReference("git-azure-devops", "fabrikam", "site", 12)].map(t => t.toJson());

    assert.deepEqual([...[1, 7, -1, 11, -15].map(t => PullRequestVote.fromJson({ ...vote, vote: t })), ...others.map(t => PullRequestVote.fromJson({ ...vote, reference: t }))],
      [null, null, null, null, null, null, null, null]);
  });

  it("refuses a payload without a reference or a whole vote", () => {
    for (const value of [null, { ...vote, reference: null }, { ...vote, vote: 2.5 }, { ...vote, vote: "10" }, { reference: vote.reference }])
      assert.throws(() => PullRequestVote.fromJson(value), JsonException);
  });
});
