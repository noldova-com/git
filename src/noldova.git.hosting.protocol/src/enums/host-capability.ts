/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

export const HostCapability = {
  SignIn: "SignIn",
  ReadItem: "ReadItem",
  BranchPullRequest: "BranchPullRequest",
  CreatePullRequest: "CreatePullRequest",
  Checks: "Checks",
  Votes: "Votes",
  Policies: "Policies",
  Builds: "Builds",
  AutoComplete: "AutoComplete",
  WorkItems: "WorkItems",
  BranchFromItem: "BranchFromItem",
  Pipelines: "Pipelines",
  AuthorAvatars: "AuthorAvatars",
  PullRequests: "PullRequests"
} as const;

export type HostCapability = (typeof HostCapability)[keyof typeof HostCapability];
