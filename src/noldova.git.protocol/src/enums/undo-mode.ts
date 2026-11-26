/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
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
