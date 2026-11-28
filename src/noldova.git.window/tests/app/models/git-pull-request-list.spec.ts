/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { FailureCode } from "@noldova/desktop.protocol";
import { RuntimeRequestException } from "@noldova/desktop.window";
import { describe, expect, it } from "vitest";

import { GitPullRequestsState } from "../../../src/app/enums/git-pull-requests-state.ts";
import { GitPullRequestList } from "../../../src/app/models/git-pull-request-list.ts";
import { GitPullRequestRow } from "../../../src/app/models/git-pull-request-row.ts";

describe("GitPullRequestList", () => {
  const rows: readonly GitPullRequestRow[] = [
    new GitPullRequestRow("octocat/site#752", "#752", "Export notes as Markdown files", "https://github.com/octocat/site/pull/752", false, 1, 2, 0, 1, "export-notes", "main")
  ];
  const read = (list: GitPullRequestList): readonly unknown[] => [list.state, list.rows, list.failure, list.hasMore, list.limitedUntil];

  it("reads with no rows, or keeps the last read's rows until it ends", () => {
    expect([read(GitPullRequestList.reading()), read(GitPullRequestList.reading(rows))]).toEqual([
      [GitPullRequestsState.Reading, [], null, false, null], [GitPullRequestsState.Reading, rows, null, false, null]
    ]);
  });

  it("is ready with its rows, and says when the host's answer was cut", () => {
    expect([read(GitPullRequestList.ready(rows)), read(GitPullRequestList.ready(rows, true)), read(GitPullRequestList.ready([], false))]).toEqual([
      [GitPullRequestsState.Ready, rows, null, false, null], [GitPullRequestsState.Ready, rows, null, true, null], [GitPullRequestsState.Ready, [], null, false, null]
    ]);
  });

  it("shows no rows while signed out", () => {
    expect(read(GitPullRequestList.signedOut())).toEqual([GitPullRequestsState.SignedOut, [], null, false, null]);
  });

  it("fails with the host's words, with no rows or keeping the last read's", () => {
    expect([read(GitPullRequestList.failed("Bad credentials")), read(GitPullRequestList.failed("Rate limit exceeded", rows))]).toEqual([
      [GitPullRequestsState.Failed, [], "Bad credentials", false, null], [GitPullRequestsState.Failed, rows, "Rate limit exceeded", false, null]
    ]);
  });

  it("fails by an error with a runtime failure's words and when the host's rate limit resets, or the fallback for any other error", () => {
    const limited = new RuntimeRequestException(FailureCode.Unavailable, "GitHub's rate limit for this account is used up until 2027-01-15T09:00:00.000Z.",
      { rateLimitedUntil: 1_800_003_600_000 });

    expect([read(GitPullRequestList.failedBy(limited, "No answer.", rows)), read(GitPullRequestList.failedBy(new Error("lost"), "No answer."))]).toEqual([
      [GitPullRequestsState.Failed, rows, "GitHub's rate limit for this account is used up until 2027-01-15T09:00:00.000Z.", false, 1_800_003_600_000],
      [GitPullRequestsState.Failed, [], "No answer.", false, null]
    ]);
  });
});
