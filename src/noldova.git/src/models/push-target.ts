/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */
import type { GitRemote, StatusUpstream } from "@noldova/git.protocol";

/** What a push sends: the current branch and its commit, the remote, its upstream there unless gone, and the revisions that leave out what the remote has. */
export class PushTarget {
  public readonly branch: string;
  public readonly head: string;
  public readonly remote: GitRemote;
  public readonly tracked: StatusUpstream | null;
  public readonly excluded: string[];

  public constructor(branch: string, head: string, remote: GitRemote, tracked: StatusUpstream | null, excluded: string[]) {
    this.branch = branch;
    this.head = head;
    this.remote = remote;
    this.tracked = tracked;
    this.excluded = excluded;
  }
}
