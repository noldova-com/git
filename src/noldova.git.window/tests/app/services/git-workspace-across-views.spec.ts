/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { FakeWindowPartContext } from "@noldova/desktop.window/testing";
import { describe, expect, it } from "vitest";

import { GitWorkspaceAcross } from "../../../src/app/models/git-workspace-across.ts";
import { GitWorkspaceReviews } from "../../../src/app/models/git-workspace-reviews.ts";
import { GitWorkspaceAcrossViews } from "../../../src/app/services/git-workspace-across-views.ts";

describe("GitWorkspaceAcrossViews", () => {
  it("keeps one Across repositories view per window", () => {
    const context = new FakeWindowPartContext();

    expect([GitWorkspaceAcrossViews.of(context) === GitWorkspaceAcrossViews.of(context),
      GitWorkspaceAcrossViews.of(context) === GitWorkspaceAcrossViews.of(new FakeWindowPartContext())]).toEqual([true, false]);
  });

  it("opens the view by its name and instance, titled Across repositories", () => {
    const context = new FakeWindowPartContext();
    const page = { open: (): void => undefined, openPullRequest: (): void => undefined, openReview: (): void => undefined, readWritten: (): void => undefined };

    GitWorkspaceAcrossViews.of(context).showOnce(new GitWorkspaceAcross("workspace-1", [], [], new GitWorkspaceReviews([], false), page));

    expect(context.callsOf("openView")).toEqual([["git.workspaceAcross", "selected", "Across repositories"]]);
  });
});
