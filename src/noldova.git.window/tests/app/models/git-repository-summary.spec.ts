/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ConflictKind, FileState, GitRemote, type GitStatus, RemoteTransport, StatusUpstream } from "@noldova/git.protocol";
import { describe, expect, it } from "vitest";

import { GitRepositorySummary } from "../../../src/app/models/git-repository-summary.ts";
import { GitFixtures } from "../../fixtures/git-fixtures.fixture.ts";

describe("GitRepositorySummary", () => {
  const remote: GitRemote = new GitRemote("origin", "github.com", "example-owner/example-repository", RemoteTransport.Https);
  const partsOf = (summary: GitRepositorySummary): readonly unknown[] => [summary.folder, summary.branch, summary.head, summary.upstream, summary.remote, summary.ahead,
    summary.behind, summary.gone, summary.staged, summary.changed, summary.conflicts, summary.files, summary.isTruncated, summary.fetchedAt, summary.isFetching,
    summary.failure, summary.isUnread];

  it("reads the branch, its upstream and its changes from the status, counting a file staged and changed once among the files", () => {
    const status: GitStatus = GitFixtures.status([
      GitFixtures.entry("a.ts", FileState.Modified, FileState.Modified),
      GitFixtures.entry("b.ts", FileState.Added, FileState.Unmodified),
      GitFixtures.entry("c.ts", FileState.Unmodified, FileState.Modified),
      GitFixtures.entry("d.ts", FileState.Unmodified, FileState.Unmodified, null, ConflictKind.BothModified)
    ], new StatusUpstream("origin/main", 2, 1, false), { remote, truncated: true, fetchedAt: "2026-11-20T14:02:00Z" });

    expect(partsOf(new GitRepositorySummary("/work/site", status, false, null))).toEqual([
      "/work/site", "main", "0123456789abcdef0123456789abcdef01234567", "origin/main", remote, 2, 1, false, 2, 2, 1, 4, true, "2026-11-20T14:02:00Z", false, null, false
    ]);
  });

  it("says a branch without an upstream, and a detached head, plainly", () => {
    const summary: GitRepositorySummary = new GitRepositorySummary("/work/site", GitFixtures.status([], null, { branch: null }), false, null);

    expect(partsOf(summary)).toEqual(["/work/site", null, "0123456789abcdef0123456789abcdef01234567", null, null, 0, 0, false, 0, 0, 0, 0, false, null, false, null, false]);
  });

  it("marks an upstream that's gone", () => {
    expect(new GitRepositorySummary("/work/site", GitFixtures.status([], new StatusUpstream("origin/old", 0, 0, true)), false, null).gone).toBe(true);
  });

  it("knows nothing of a repository no read has reached, with why the read failed", () => {
    expect(partsOf(new GitRepositorySummary("/work/site", null, false, "Not a repository."))).toEqual([
      "/work/site", null, null, null, null, 0, 0, false, 0, 0, 0, 0, false, null, false, "Not a repository.", true
    ]);
  });

  it("fetches with what it last read and no failure, and fails a fetch keeping what it read", () => {
    const read: GitRepositorySummary = new GitRepositorySummary("/work/site", GitFixtures.status([], new StatusUpstream("origin/main", 0, 3, false)), false, "Earlier failure.");
    const fetching: GitRepositorySummary = read.asFetching();
    const failed: GitRepositorySummary = fetching.withFailure("The remote refused.");

    expect([[fetching.isFetching, fetching.failure, fetching.behind, fetching.upstream], [failed.isFetching, failed.failure, failed.behind, failed.upstream]])
      .toEqual([[true, null, 3, "origin/main"], [false, "The remote refused.", 3, "origin/main"]]);
  });
});
