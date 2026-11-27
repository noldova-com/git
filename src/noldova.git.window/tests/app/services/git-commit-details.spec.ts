/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Injector, signal, type WritableSignal } from "@angular/core";
import { TestBed } from "@angular/core/testing";
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

  it("shows the window's Commit view, a plain view with no instance, and listens to no closing, since the view stays in the layout", () => {
    const context: FakeWindowPartContext = new FakeWindowPartContext();
    const details: GitDetailView<GitCommitView> = GitCommitDetails.of(context);
    const stop: () => void = details.listen();

    details.showInFront(view);
    stop();

    expect([context.callsOf("showView"), context.callsOf("openView"), context.callsOf("onViewClosed"), details.isOpen()])
      .toEqual([[["git.commitView"]], [], [], true]);
  });

  it("leaves the Commit view where it is as the page in front chooses a commit and as it goes, since the view is shown by default", () => {
    const context: FakeWindowPartContext = new FakeWindowPartContext();
    const details: GitDetailView<GitCommitView> = GitCommitDetails.of(context);
    const active: WritableSignal<boolean> = signal(true);
    TestBed.runInInjectionContext(() => details.follow(signal(view), active, TestBed.inject(Injector)));
    TestBed.tick();

    active.set(false);
    TestBed.tick();

    expect([details.shown(), context.callsOf("showView"), context.callsOf("returnView")]).toEqual([view, [], []]);
  });
});
