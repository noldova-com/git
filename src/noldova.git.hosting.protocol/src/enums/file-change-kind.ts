/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

/** What a pull request did to a file: added it, changed it, deleted it, or moved it, with or without changes. */
export const FileChangeKind = {
  Added: "Added",
  Modified: "Modified",
  Deleted: "Deleted",
  Renamed: "Renamed"
} as const;

export type FileChangeKind = (typeof FileChangeKind)[keyof typeof FileChangeKind];
