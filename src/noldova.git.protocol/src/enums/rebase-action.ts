/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

/** What an interactive rebase does with one of the branch's commits. */
export const RebaseAction = {
  Pick: "Pick",
  Reword: "Reword",
  Edit: "Edit",
  Squash: "Squash",
  Fixup: "Fixup",
  Drop: "Drop"
} as const;

export type RebaseAction = (typeof RebaseAction)[keyof typeof RebaseAction];
