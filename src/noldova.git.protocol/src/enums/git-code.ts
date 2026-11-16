/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

export const GitCode = {
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
} as const;

export type GitCode = (typeof GitCode)[keyof typeof GitCode];
