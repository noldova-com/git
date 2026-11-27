/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { FakeWindowPartContext } from "@noldova/desktop.window/testing";
import { describe, expect, it } from "vitest";

import type { IGitWorkspaceAcrossPage } from "../../../src/app/interfaces/i-git-workspace-across-page.ts";
import { GitWorkspaceAcross } from "../../../src/app/models/git-workspace-across.ts";
import { GitWorkspaceReviews } from "../../../src/app/models/git-workspace-reviews.ts";
import { GitWorkspaceAcrossViews } from "../../../src/app/services/git-workspace-across-views.ts";

describe("GitWorkspaceAcrossViews", () => {
  it("keeps one Across repositories view per window", () => {
    const context = new FakeWindowPartContext();

    expect([GitWorkspaceAcrossViews.of(context) === GitWorkspaceAcrossViews.of(context),
      GitWorkspaceAcrossViews.of(context) === GitWorkspaceAcrossViews.of(new FakeWindowPartContext())]).toEqual([true, false]);
  });

  it("titles its view Across repositories when it is shown for a choice", () => {
    const context = new FakeWindowPartContext();

    const page: IGitWorkspaceAcrossPage = { open: () => undefined, openPullRequest: () => undefined, openReview: () => undefined, readWritten: () => undefined };

    GitWorkspaceAcrossViews.of(context).showInFront(new GitWorkspaceAcross("workspace-1", [], [], new GitWorkspaceReviews([], false), page));

    expect(context.callsOf("openView")).toEqual([["git.workspaceAcross", "selected", "Across repositories"]]);
  });

  it("opens its one document in the middle, titled Across repositories, and never a dock view", () => {
    const context = new FakeWindowPartContext();
    context.allow("openDocument");

    GitWorkspaceAcrossViews.open(context);
    GitWorkspaceAcrossViews.open(context);

    expect([context.callsOf("openDocument"), context.callsOf("openView")]).toEqual([
      [["git.workspaceAcross", "selected", "Across repositories"], ["git.workspaceAcross", "selected", "Across repositories"]], []
    ]);
  });
});
