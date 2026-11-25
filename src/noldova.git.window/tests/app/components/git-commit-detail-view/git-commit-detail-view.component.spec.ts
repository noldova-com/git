/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { GitCommit, GitCommitDetail, GitGraphCommit, LineKind } from "@noldova/git.protocol";
import { describe, expect, it, onTestFinished } from "vitest";

import { GitCommitView } from "../../../../src/app/models/git-commit-view.ts";
import { GitViewing } from "../../../../src/app/services/git-viewing.ts";
import { GitFixtures } from "../../../fixtures/git-fixtures.fixture.ts";
import { GitViewFixture } from "../../../fixtures/git-view.fixture.ts";

describe("GitCommitDetailViewComponent", () => {
  const commitOf = (id: string, subject: string): GitGraphCommit =>
    new GitGraphCommit(new GitCommit(id.repeat(40), ["d".repeat(40)], "Sample Author", "2026-11-20T14:02:00Z", subject), "author@example.com", []);
  const answers = {
    ...GitFixtures.watching, "git.status": GitFixtures.status().toJson(), "git.diff": GitFixtures.diff("a.ts", [LineKind.Added, "one"]).toJson(),
    "git.commitDetail": new GitCommitDetail("c".repeat(40), "", "Sample Author", "author@example.com", "2026-11-20T14:02:00Z", false).toJson()
  };

  it("says how to choose a commit, then shows each commit chosen in the folder, and how to choose one again once none is", async () => {
    onTestFinished(() => GitViewing.showChanges(GitFixtures.folder));
    const view: GitViewFixture = await GitViewFixture.renderCommitAsync(answers, ".empty-view");
    const empty: readonly string[] = view.texts(".empty-view");

    GitViewing.show(new GitCommitView(GitFixtures.folder, commitOf("c", "Follow renames")));
    await view.waitForAsync(".detail .subject");
    const first: readonly string[] = view.texts(".subject");
    GitViewing.show(new GitCommitView(GitFixtures.folder, commitOf("e", "Keep each path")));
    await view.untilAsync(() => view.texts(".subject").includes("Keep each path"));
    GitViewing.showChanges(GitFixtures.folder);
    await view.waitForAsync(".empty-view");

    expect([empty, first, view.all(".detail").length, view.texts(".empty-view")])
      .toEqual([["Choose a commit in History to see it here"], ["Follow renames"], 0, ["Choose a commit in History to see it here"]]);
  });
});
