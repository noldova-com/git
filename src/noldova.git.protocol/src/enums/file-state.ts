/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

export const FileState = {
  Unmodified: "Unmodified",
  Modified: "Modified",
  TypeChanged: "TypeChanged",
  Added: "Added",
  Deleted: "Deleted",
  Renamed: "Renamed",
  Copied: "Copied",
  Untracked: "Untracked",
  Ignored: "Ignored"
} as const;

export type FileState = (typeof FileState)[keyof typeof FileState];
