/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

export const ScanEnd = {
  Repository: "Repository",
  Complete: "Complete",
  RepositoryLimit: "RepositoryLimit",
  FolderLimit: "FolderLimit",
  Unreadable: "Unreadable"
} as const;

export type ScanEnd = (typeof ScanEnd)[keyof typeof ScanEnd];
