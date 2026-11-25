/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

/** How the module watches a worktree's files: with one watch of its whole tree, with a watch of each folder git doesn't ignore, or not at all. */
export const TreeWatch = {
  Whole: "Whole",
  Folders: "Folders",
  None: "None"
} as const;

export type TreeWatch = (typeof TreeWatch)[keyof typeof TreeWatch];
