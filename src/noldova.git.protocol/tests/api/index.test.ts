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
      "ConflictResolution",
      "DiffFile",
      "DiffHunk",
      "DiffLine",
      "DiffScope",
      "DiffScopeKind",
      "FailureCode",
      "FileChange",
      "FileState",
      "GitAvatar",
      "GitAvatarParams",
      "GitBranchAtParams",
      "GitBranchParams",
      "GitBranchRenameParams",
      "GitBranchTip",
      "GitBranchTrack",
      "GitBranches",
      "GitChanged",
      "GitCode",
      "GitCommand",
      "GitCommandLog",
      "GitCommit",
      "GitCommitDetail",
      "GitCommitDetailParams",
      "GitCommitParams",
      "GitCommitSignature",
      "GitCommitSigning",
      "GitConflict",
      "GitConflictParams",
      "GitDiff",
      "GitDiffParams",
      "GitDiffPaths",
      "GitFailure",
      "GitFetchParams",
      "GitFolderBinding",
      "GitFolderParams",
      "GitForcePushParams",
      "GitGraph",
      "GitGraphCommit",
      "GitGraphParams",
      "GitHooks",
      "GitJournal",
      "GitJournalEntry",
      "GitLinesParams",
      "GitLog",
      "GitLogParams",
      "GitMarkerCheck",
      "GitMergedBranches",
      "GitMessageReference",
      "GitMessageReferenceKind",
      "GitMessageReferences",
      "GitMessageReferencesParams",
      "GitNames",
      "GitOperation",
      "GitOperationParams",
      "GitPathsParams",
      "GitPickParams",
      "GitPredictParams",
      "GitPrediction",
      "GitPullParams",
      "GitPushParams",
      "GitRebaseCheck",
      "GitRebaseCheckParams",
      "GitRebaseCommit",
      "GitRebaseParams",
      "GitRebasePlan",
      "GitRebasePlanParams",
      "GitRebaseStepCheck",
      "GitRef",
      "GitRefMove",
      "GitRemote",
      "GitRemoteTracks",
      "GitRepositories",
      "GitRepositoryItems",
      "GitResetParams",
      "GitResolveParams",
      "GitStash",
      "GitStashParams",
      "GitStatus",
      "GitSubmodule",
      "GitTag",
      "GitTagAtParams",
      "GitTagParams",
      "GitUndoCommitParams",
      "GitUndoParams",
      "GitWorktree",
      "GitWorktrees",
      "LineCounts",
      "LineKind",
      "OperationKind",
      "PredictionAction",
      "PredictionOutcome",
      "ProtocolException",
      "ProtocolFieldException",
      "RebaseAction",
      "RebaseCheckOutcome",
      "RebaseStep",
      "RefKind",
      "RemoteTransport",
      "ResetMode",
      "RiskLevel",
      "SignatureState",
      "SigningFormat",
      "StatusEntry",
      "StatusUpstream",
      "SubmoduleChange",
      "SubmoduleStatus",
      "UndoMode",
      "UntrustedSource",
      "WorktreeRecord"
    ]);
    assert.deepEqual(api.FileState, { Unmodified: "Unmodified", Modified: "Modified", TypeChanged: "TypeChanged", Added: "Added", Deleted: "Deleted", Renamed: "Renamed", Copied: "Copied", Untracked: "Untracked", Ignored: "Ignored" });
    assert.deepEqual(api.ConflictKind, { BothModified: "BothModified", BothAdded: "BothAdded", BothDeleted: "BothDeleted", AddedByUs: "AddedByUs", AddedByThem: "AddedByThem", DeletedByUs: "DeletedByUs", DeletedByThem: "DeletedByThem" });
    assert.deepEqual(api.ConflictResolution, { Text: "Text", Ours: "Ours", Theirs: "Theirs", Delete: "Delete" });
    assert.deepEqual(api.DiffScopeKind, { Worktree: "Worktree", Staged: "Staged", Range: "Range" });
    assert.deepEqual(api.FileChange, { Added: "Added", Modified: "Modified", Deleted: "Deleted", Renamed: "Renamed", Copied: "Copied", TypeChanged: "TypeChanged", Conflict: "Conflict" });
    assert.deepEqual(api.LineKind, { Context: "Context", Added: "Added", Removed: "Removed", NoNewlineAtEnd: "NoNewlineAtEnd" });
    assert.deepEqual(api.OperationKind, { Merge: "Merge", Rebase: "Rebase", CherryPick: "CherryPick", Revert: "Revert" });
    assert.deepEqual(api.RemoteTransport, { Ssh: "Ssh", Https: "Https", File: "File", Other: "Other" });
    assert.deepEqual(api.RefKind, { Head: "Head", Branch: "Branch", RemoteBranch: "RemoteBranch", Tag: "Tag" });
    assert.deepEqual(api.UndoMode, { None: "None", Index: "Index", Refs: "Refs", Mixed: "Mixed", Keep: "Keep", Switch: "Switch", Checkpoint: "Checkpoint", Stash: "Stash" });
    assert.deepEqual(api.ResetMode, { Soft: "Soft", Mixed: "Mixed", Keep: "Keep" });
    assert.deepEqual(api.PredictionAction, { Merge: "Merge", CherryPick: "CherryPick", Revert: "Revert" });
    assert.deepEqual(api.RebaseAction, { Pick: "Pick", Reword: "Reword", Edit: "Edit", Squash: "Squash", Fixup: "Fixup", Drop: "Drop" });
    assert.deepEqual(api.RebaseCheckOutcome, { Clean: "Clean", Conflicts: "Conflicts", Folded: "Folded", Dropped: "Dropped", Unavailable: "Unavailable" });
    assert.deepEqual(api.PredictionOutcome, { UpToDate: "UpToDate", FastForward: "FastForward", Clean: "Clean", Conflicts: "Conflicts", Unavailable: "Unavailable" });
    assert.deepEqual(api.SignatureState, { Verified: "Verified", Unverified: "Unverified", None: "None" });
    assert.deepEqual(api.SigningFormat, { OpenPgp: "OpenPgp", Ssh: "Ssh", X509: "X509" });
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
      GhSignInNeeded: "GhSignInNeeded",
      PushBehind: "PushBehind",
      NothingToStash: "NothingToStash"
    });
    assert.deepEqual({ ...api.RiskLevel }, {
      Read: "Read",
      LocalReversible: "LocalReversible",
      Commit: "Commit",
      LocalDestructive: "LocalDestructive",
      Remote: "Remote"
    });
    assert.deepEqual({ ...api.UntrustedSource }, { Repository: "Repository", GitHub: "GitHub" });
    assert.deepEqual({ ...api.GitMessageReferenceKind }, { AzureBoards: "AzureBoards" });
  });
});
