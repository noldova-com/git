/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { GitRebaseCommit, GitRebasePlan } from "@noldova/git.protocol";
import { FakeWindowPartContext } from "@noldova/desktop.window/testing";
import { describe, expect, it } from "vitest";

import { GitRebasePreview } from "../../../src/app/models/git-rebase-preview.ts";
import { GitRebasePreviews } from "../../../src/app/services/git-rebase-previews.ts";

const plan: GitRebasePlan = new GitRebasePlan("feature/graph", "0".repeat(40), "b".repeat(40), 0,
  [new GitRebaseCommit("a".repeat(40), "Read the log as a stream", null)], [], false);

describe("GitRebasePreviews", () => {
  it("keeps one Rebase preview view per window", () => {
    const context = new FakeWindowPartContext();

    expect([GitRebasePreviews.of(context) === GitRebasePreviews.of(context), GitRebasePreviews.of(context) === GitRebasePreviews.of(new FakeWindowPartContext())])
      .toEqual([true, false]);
  });

  it("opens the view by its name and instance, titled Rebase preview", () => {
    const context = new FakeWindowPartContext();

    GitRebasePreviews.of(context).showOnce(new GitRebasePreview("/work/git", plan, "main", 1, [], [], null, null));

    expect(context.callsOf("openView")).toEqual([["git.rebasePreview", "selected", "Rebase preview"]]);
  });
});
