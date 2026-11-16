/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

export enum GitViewPhase {
  NoFolder = "NoFolder",
  Loading = "Loading",
  Ready = "Ready",
  NotRepository = "NotRepository",
  FolderUnreadable = "FolderUnreadable",
  GitMissing = "GitMissing",
  GitTooOld = "GitTooOld",
  Failed = "Failed",
  FolderFailed = "FolderFailed"
}
