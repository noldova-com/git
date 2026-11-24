/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */
import type { IPermissionRequest } from "@noldova/desktop.runtime";
import type { GitStatus, UndoMode } from "@noldova/git.protocol";

import type { RepositoryFolders } from "../models/repository-folders.ts";
import type { IWriteCheckpoint } from "./i-write-checkpoint.ts";
import type { IWriteCall } from "./i-write-call.ts";

export interface IGitWrite {
  /** The write's method name, which its journal entry names. */
  readonly method: string;
  /** How the journal undoes the write. */
  readonly undo: UndoMode;
  /** The checkpoint the write took before it ran, which the journal keeps for its undo; none for most writes. */
  readonly checkpoint?: IWriteCheckpoint | null;

  refuse(status: GitStatus): void;

  requestAsync(folders: RepositoryFolders, status: GitStatus, call: IWriteCall, signal?: AbortSignal): Promise<IPermissionRequest | null>;

  runAsync(folders: RepositoryFolders, status: GitStatus, signal?: AbortSignal): Promise<void>;
}
