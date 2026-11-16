/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

export const DiffScopeKind = {
  Worktree: "Worktree",
  Staged: "Staged",
  Range: "Range"
} as const;

export type DiffScopeKind = (typeof DiffScopeKind)[keyof typeof DiffScopeKind];
