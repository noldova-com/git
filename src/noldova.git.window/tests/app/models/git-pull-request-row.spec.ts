/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { describe, expect, it } from "vitest";

import { GitPullRequestRow } from "../../../src/app/models/git-pull-request-row.ts";

describe("GitPullRequestRow", () => {
  const read = (row: GitPullRequestRow): readonly unknown[] => [row.key, row.label, row.title, row.url, row.isDraft, row.approvals, row.passed, row.failing, row.pending,
    row.headBranch, row.baseBranch];

  it("holds the pull request's key, label, title, page, draft state, approvals, checks and branches", () => {
    expect(read(new GitPullRequestRow("octocat/site#752", "#752", "Export notes as Markdown files", "https://github.com/octocat/site/pull/752", true, 1, 2, 3, 4, "export-notes",
      "main"))).toEqual(["octocat/site#752", "#752", "Export notes as Markdown files", "https://github.com/octocat/site/pull/752", true, 1, 2, 3, 4, "export-notes", "main"]);
  });

  it("has no base branch when the host didn't say", () => {
    expect(new GitPullRequestRow("42", "!42", "Sign in with a passkey", "https://example.com/merge_requests/42", false, 0, 0, 0, 0, "passkey").baseBranch).toBeNull();
  });
});
