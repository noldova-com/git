/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { RepositoryQuery } from "@noldova/git.hosting.protocol";
import type { GitRemote } from "@noldova/git.protocol";

export class ListRead {
  public readonly folder: string;
  public readonly remote: GitRemote;
  public readonly query: RepositoryQuery;

  public constructor(folder: string, remote: GitRemote, query: RepositoryQuery) {
    this.folder = folder;
    this.remote = remote;
    this.query = query;
  }
}
