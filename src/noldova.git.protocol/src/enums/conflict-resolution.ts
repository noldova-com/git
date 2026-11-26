/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

export const ConflictResolution = {
  Text: "Text",
  Ours: "Ours",
  Theirs: "Theirs",
  Delete: "Delete"
} as const;

export type ConflictResolution = (typeof ConflictResolution)[keyof typeof ConflictResolution];
