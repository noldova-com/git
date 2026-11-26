/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { FakeWindowPartContext } from "@noldova/desktop.window/testing";
import { GitCommit, GitGraphCommit } from "@noldova/git.protocol";
import { describe, expect, it } from "vitest";

import { GitCommitView } from "../../../src/app/models/git-commit-view.ts";
import { GitCommitDetails } from "../../../src/app/services/git-commit-details.ts";
import type { GitDetailView } from "../../../src/app/services/git-detail-view.ts";

describe("GitCommitDetails", () => {
  const view: GitCommitView = new GitCommitView("/work/repository",
    new GitGraphCommit(new GitCommit("c".repeat(40), [], "Sample Author", "2026-11-20T14:02:00Z", "Follow renames"), "author@example.com", []));

  it("keeps one Commit view for each window, and another for another window", () => {
    const first: FakeWindowPartContext = new FakeWindowPartContext();
    const second: FakeWindowPartContext = new FakeWindowPartContext();

    expect([GitCommitDetails.of(first) === GitCommitDetails.of(first), GitCommitDetails.of(first) === GitCommitDetails.of(second)]).toEqual([true, false]);
  });

  it("opens the window's Commit view as its one instance titled Commit, and hears the person close that instance only", () => {
    const context: FakeWindowPartContext = new FakeWindowPartContext();
    const details: GitDetailView<GitCommitView> = GitCommitDetails.of(context);
    const stop: () => void = details.listen();

    details.showInFront(view);
    context.raiseViewClosed("git.commitView", "another");
    const open: boolean = details.isOpen();
    context.raiseViewClosed("git.commitView", "selected");
    stop();

    expect([context.callsOf("openView"), context.callsOf("showView"), open, details.isOpen()])
      .toEqual([[["git.commitView", "selected", "Commit"]], [], true, false]);
  });
});
