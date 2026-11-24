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

import { PullRequestCompletion } from "../../src/models/pull-request-completion.ts";

const reference: HostReference = new HostReference("git-azure-devops", "fabrikam", "3411ebc1-d5aa-464f-9615-0b527bc66719", 752);
const commit: string = "9f2c4e1a7b3d5f6081c2e4a6b8d0f1e3a5c7b9d1";
const completion = {
  reference: reference.toJson(), sourceCommit: commit, targetBranch: "main", mergeType: "squash", message: "Merged PR 752: Fold tag case", completeWorkItems: true,
  deleteSourceBranch: false
};

describe("PullRequestCompletion", () => {
  it("reads each merge type, with a message for all but rebase", () => {
    const read = [{ mergeType: "noFastForward" }, { mergeType: "squash" }, { mergeType: "rebase", message: null }, { mergeType: "rebaseMerge" },
      { message: "m".repeat(4000), completeWorkItems: false, deleteSourceBranch: true }].map(t => PullRequestCompletion.fromJson({ ...completion, ...t }));

    assert.deepEqual(read, [new PullRequestCompletion(reference, commit, "main", "noFastForward", "Merged PR 752: Fold tag case", true, false),
      new PullRequestCompletion(reference, commit, "main", "squash", "Merged PR 752: Fold tag case", true, false),
      new PullRequestCompletion(reference, commit, "main", "rebase", null, true, false),
      new PullRequestCompletion(reference, commit, "main", "rebaseMerge", "Merged PR 752: Fold tag case", true, false),
      new PullRequestCompletion(reference, commit, "main", "squash", "m".repeat(4000), false, true)]);
  });

  it("answers null for another host's or organization's reference, a commit that isn't a whole id, a blank branch or an unknown merge type", () => {
    const others = [new HostReference("git-github", "octocat", "hello-world", 752), new HostReference("git-azure-devops", "fab_rikam", reference.repository, 752)]
      .map(t => ({ reference: t.toJson() }));
    const values = [...others, { sourceCommit: commit.slice(0, 39) }, { sourceCommit: commit.toUpperCase() }, { sourceCommit: `${commit}0` }, { targetBranch: " " },
      { mergeType: "fastForward" }, { mergeType: "Squash" }];

    assert.deepEqual(values.map(t => PullRequestCompletion.fromJson({ ...completion, ...t })), values.map(() => null));
  });

  it("answers null for a message on rebase, none on a merge, a blank one or one over 4,000 characters", () => {
    const values = [{ mergeType: "rebase" }, { message: null }, { message: " \n " }, { message: "m".repeat(4001) }];

    assert.deepEqual(values.map(t => PullRequestCompletion.fromJson({ ...completion, ...t })), values.map(() => null));
  });

  it("refuses a payload without a reference, the strings or both booleans", () => {
    for (const value of [null, { ...completion, reference: null }, { ...completion, sourceCommit: 7 }, { ...completion, mergeType: null },
      { ...completion, message: 3 }, { ...completion, completeWorkItems: "true" }, { ...completion, deleteSourceBranch: undefined }])
      assert.throws(() => PullRequestCompletion.fromJson(value), JsonException);
  });
});
