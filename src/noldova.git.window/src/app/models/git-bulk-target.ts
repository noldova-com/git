/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { GitRemote } from "@noldova/git.protocol";

/** A repository a bulk push or pull works on, as its confirm names it: the branch, and the upstream with its remote, or null without one. */
export class GitBulkTarget {
  public readonly folder: string;
  public readonly repository: string;
  public readonly branch: string;
  public readonly upstream: string | null;
  /** The branch's remote as the confirm read it, or null without one. */
  public readonly remote: GitRemote | null;

  public constructor(folder: string, repository: string, branch: string, upstream: string | null, remote: GitRemote | null) {
    this.folder = folder;
    this.repository = repository;
    this.branch = branch;
    this.upstream = upstream;
    this.remote = remote;
  }
}
