/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { GitCommit, GitGraphCommit } from "@noldova/git.protocol";
import { describe, expect, it } from "vitest";

import { GitCommitView } from "../../../src/app/models/git-commit-view.ts";

describe("GitCommitView", () => {
  it("holds the repository's folder and the selected commit", () => {
    const commit: GitGraphCommit = new GitGraphCommit(new GitCommit("c".repeat(40), ["d".repeat(40)], "Sample Author", "2026-11-20T14:02:00Z", "Follow renames"),
      "author@example.com", []);
    const view: GitCommitView = new GitCommitView("/work/project", commit);

    expect([view.folder, view.commit]).toEqual(["/work/project", commit]);
  });
});
