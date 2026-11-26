/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { GitRebaseCommit, GitRebasePlan } from "@noldova/git.protocol";
import { describe, expect, it } from "vitest";

import { GitRebasePreview, type IGitRebaseStop } from "../../../src/app/models/git-rebase-preview.ts";

const onto: string = "0123456789abcdef0123456789abcdef01234567";
const base: string = "fedcba9876543210fedcba9876543210fedcba98";
const commits: readonly GitRebaseCommit[] = [new GitRebaseCommit("a".repeat(40), "Read the log as a stream", null)];

describe("GitRebasePreview", () => {
  it("holds what the Rebase preview view shows, naming the branch and the base's and onto commit's short ids", () => {
    const plan = new GitRebasePlan("feature/graph", onto, base, 2, commits, [], false);
    const stop: IGitRebaseStop = { step: 1, paths: ["src/log.ts"], commit: "aaaaaaa" };

    const preview = new GitRebasePreview("/work/git", plan, "main", 1, ["feature/minimap"], ["Read the log as a stream"], stop, "src/log.ts");

    expect([preview.folder, preview.plan, preview.onto, preview.count, preview.stacked, preview.after, preview.stop, preview.stopped]).toEqual(
      ["/work/git", plan, "main", 1, ["feature/minimap"], ["Read the log as a stream"], stop, "src/log.ts"]);
    expect([preview.branch, preview.base, preview.ontoCommit]).toEqual(["feature/graph", "fedcba9", "0123456"]);
  });

  it("names HEAD as the branch when HEAD is detached", () => {
    const preview = new GitRebasePreview("/work/git", new GitRebasePlan(null, onto, base, 0, commits, [], false), "main", 1, [], [], null, null);

    expect(preview.branch).toBe("HEAD");
  });
});
