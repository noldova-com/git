/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * How a write recorded in the journal is undone: not at all; the index put back; the refs put back, with the index and working folder kept;
 * the current branch reset back with its index; reset back keeping local changes; switched back to the branch it left; the paths a
 * discard changed put back from the checkpoint taken before it; or a stash's changes put back by popping it.
 */
export const UndoMode = {
  None: "None",
  Index: "Index",
  Refs: "Refs",
  Mixed: "Mixed",
  Keep: "Keep",
  Switch: "Switch",
  Checkpoint: "Checkpoint",
  Stash: "Stash"
} as const;

export type UndoMode = (typeof UndoMode)[keyof typeof UndoMode];
