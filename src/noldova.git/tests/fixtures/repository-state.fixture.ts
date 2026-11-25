/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { IPermissionRequest } from "@noldova/desktop.runtime";
import type { GitStatus } from "@noldova/git.protocol";

import type { IGitWrite } from "../../src/interfaces/i-git-write.ts";
import type { IWriteCall } from "../../src/interfaces/i-write-call.ts";
import type { RepositoryFolders } from "../../src/models/repository-folders.ts";

/** A repository's folders and the status read in them, which a write's test runs the write against. */
export class RepositoryState {
  public readonly folders: RepositoryFolders;
  public readonly status: GitStatus;

  public constructor(folders: RepositoryFolders, status: GitStatus) {
    this.folders = folders;
    this.status = status;
  }

  public requestAsync(write: IGitWrite, call: IWriteCall): Promise<IPermissionRequest | null> {
    return write.requestAsync(this.folders, this.status, call);
  }

  public runAsync(write: IGitWrite): Promise<void> {
    return write.runAsync(this.folders, this.status);
  }
}
