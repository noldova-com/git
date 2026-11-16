/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

export const FileChange = {
  Added: "Added",
  Modified: "Modified",
  Deleted: "Deleted",
  Renamed: "Renamed",
  Copied: "Copied",
  TypeChanged: "TypeChanged",
  Conflict: "Conflict"
} as const;

export type FileChange = (typeof FileChange)[keyof typeof FileChange];
