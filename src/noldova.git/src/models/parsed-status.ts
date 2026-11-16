/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */
import { type GitOperation, type GitRemote, GitStatus, type StatusEntry, type StatusUpstream } from "@noldova/git.protocol";

export class ParsedStatus {
  public readonly branch: string | null;
  public readonly head: string | null;
  public readonly upstream: StatusUpstream | null;
  public readonly entries: readonly StatusEntry[];
  public readonly truncated: boolean;

  public constructor(branch: string | null, head: string | null, upstream: StatusUpstream | null, entries: readonly StatusEntry[], truncated: boolean) {
    this.branch = branch;
    this.head = head;
    this.upstream = upstream;
    this.entries = entries;
    this.truncated = truncated;
  }

  public toStatus(entries: readonly StatusEntry[], fingerprint: string, operation: GitOperation | null, remote: GitRemote | null): GitStatus {
    return new GitStatus(this.branch, this.head, this.upstream, entries, this.truncated, fingerprint, operation, remote);
  }
}
