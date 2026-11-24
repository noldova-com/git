/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { describe, expect, it } from "vitest";

import { GitPullRequestsState } from "../../../src/app/enums/git-pull-requests-state.ts";
import { GitPullRequestList } from "../../../src/app/models/git-pull-request-list.ts";
import { GitPullRequestRow } from "../../../src/app/models/git-pull-request-row.ts";

describe("GitPullRequestList", () => {
  const rows: readonly GitPullRequestRow[] = [
    new GitPullRequestRow("octocat/site#482", "#482", "Export notes as Markdown files", "https://github.com/octocat/site/pull/482", false, 1, 2, 0, 1, "export-notes", "main")
  ];
  const read = (list: GitPullRequestList): readonly unknown[] => [list.state, list.rows, list.failure, list.hasMore];

  it("reads with no rows, or keeps the last read's rows until it ends", () => {
    expect([read(GitPullRequestList.reading()), read(GitPullRequestList.reading(rows))]).toEqual([
      [GitPullRequestsState.Reading, [], null, false], [GitPullRequestsState.Reading, rows, null, false]
    ]);
  });

  it("is ready with its rows, and says when the host's answer was cut", () => {
    expect([read(GitPullRequestList.ready(rows)), read(GitPullRequestList.ready(rows, true)), read(GitPullRequestList.ready([], false))]).toEqual([
      [GitPullRequestsState.Ready, rows, null, false], [GitPullRequestsState.Ready, rows, null, true], [GitPullRequestsState.Ready, [], null, false]
    ]);
  });

  it("shows no rows while signed out", () => {
    expect(read(GitPullRequestList.signedOut())).toEqual([GitPullRequestsState.SignedOut, [], null, false]);
  });

  it("fails with the host's words, with no rows or keeping the last read's", () => {
    expect([read(GitPullRequestList.failed("Bad credentials")), read(GitPullRequestList.failed("Rate limit exceeded", rows))]).toEqual([
      [GitPullRequestsState.Failed, [], "Bad credentials", false], [GitPullRequestsState.Failed, rows, "Rate limit exceeded", false]
    ]);
  });
});
