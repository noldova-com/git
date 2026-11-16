/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";

import { describe, it } from "vitest";

import * as api from "../../src/api/index.ts";

describe("The protocol package's API", () => {
  it("exports its values, and each enum valued by its names", () => {
    assert.deepEqual(Object.keys(api).toSorted(), [
      "ConflictKind",
      "DiffFile",
      "DiffHunk",
      "DiffLine",
      "DiffScope",
      "DiffScopeKind",
      "FailureCode",
      "FileChange",
      "FileState",
      "GitBranchParams",
      "GitBranches",
      "GitChanged",
      "GitCode",
      "GitCommit",
      "GitCommitParams",
      "GitDiff",
      "GitDiffParams",
      "GitDiffPaths",
      "GitFailure",
      "GitFolderBinding",
      "GitFolderParams",
      "GitHooks",
      "GitLog",
      "GitLogParams",
      "GitNames",
      "GitOperation",
      "GitPathsParams",
      "GitPullParams",
      "GitPushParams",
      "GitRemote",
      "GitRepositories",
      "GitStatus",
      "GitWorktree",
      "GitWorktrees",
      "LineCounts",
      "LineKind",
      "OperationKind",
      "ProtocolException",
      "ProtocolFieldException",
      "RemoteTransport",
      "RiskLevel",
      "StatusEntry",
      "StatusUpstream",
      "SubmoduleChange",
      "SubmoduleStatus",
      "UntrustedSource",
      "WorktreeRecord"
    ]);
    assert.deepEqual(api.FileState, { Unmodified: "Unmodified", Modified: "Modified", TypeChanged: "TypeChanged", Added: "Added", Deleted: "Deleted", Renamed: "Renamed", Copied: "Copied", Untracked: "Untracked", Ignored: "Ignored" });
    assert.deepEqual(api.ConflictKind, { BothModified: "BothModified", BothAdded: "BothAdded", BothDeleted: "BothDeleted", AddedByUs: "AddedByUs", AddedByThem: "AddedByThem", DeletedByUs: "DeletedByUs", DeletedByThem: "DeletedByThem" });
    assert.deepEqual(api.DiffScopeKind, { Worktree: "Worktree", Staged: "Staged", Range: "Range" });
    assert.deepEqual(api.FileChange, { Added: "Added", Modified: "Modified", Deleted: "Deleted", Renamed: "Renamed", Copied: "Copied", TypeChanged: "TypeChanged", Conflict: "Conflict" });
    assert.deepEqual(api.LineKind, { Context: "Context", Added: "Added", Removed: "Removed", NoNewlineAtEnd: "NoNewlineAtEnd" });
    assert.deepEqual(api.OperationKind, { Merge: "Merge", Rebase: "Rebase", CherryPick: "CherryPick", Revert: "Revert" });
    assert.deepEqual(api.RemoteTransport, { Ssh: "Ssh", Https: "Https", File: "File", Other: "Other" });
    assert.deepEqual({ ...api.FailureCode }, {
      Refused: "Refused",
      Denied: "Denied",
      Expired: "Expired",
      Withdrawn: "Withdrawn",
      Stale: "Stale",
      TimedOut: "TimedOut",
      TooLarge: "TooLarge",
      Unavailable: "Unavailable",
      NotRepository: "NotRepository",
      Git: "Git"
    });
    assert.deepEqual({ ...api.GitCode }, {
      NotARepository: "NotARepository",
      FolderUnreadable: "FolderUnreadable",
      UnsafeRepository: "UnsafeRepository",
      IndexLocked: "IndexLocked",
      Conflict: "Conflict",
      BranchCheckedOut: "BranchCheckedOut",
      LockedElsewhere: "LockedElsewhere",
      BranchUnmerged: "BranchUnmerged",
      NothingToCommit: "NothingToCommit",
      HookFailed: "HookFailed",
      PushRejected: "PushRejected",
      ChangesInTheWay: "ChangesInTheWay",
      HostKeyUnknown: "HostKeyUnknown",
      KeyRefused: "KeyRefused",
      CredentialsNeeded: "CredentialsNeeded",
      NoUpstream: "NoUpstream",
      Diverged: "Diverged",
      OutcomeUnknown: "OutcomeUnknown",
      UnreadableOutput: "UnreadableOutput",
      GitMissing: "GitMissing",
      GitTooOld: "GitTooOld",
      GhMissing: "GhMissing",
      GhTooOld: "GhTooOld",
      GhSignInUnconfirmed: "GhSignInUnconfirmed",
      GhSignInNeeded: "GhSignInNeeded"
    });
    assert.deepEqual({ ...api.RiskLevel }, {
      Read: "Read",
      LocalReversible: "LocalReversible",
      Commit: "Commit",
      LocalDestructive: "LocalDestructive",
      Remote: "Remote"
    });
    assert.deepEqual({ ...api.UntrustedSource }, { Repository: "Repository", GitHub: "GitHub" });
  });
});
