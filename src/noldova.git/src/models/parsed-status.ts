/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */
import { type GitOperation, type GitRemote, GitStatus, type StatusEntry, StatusUpstream } from "@noldova/git.protocol";

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

  /** The status, with the upstream's tracking ref at `upstreamId`, which the status output doesn't carry. */
  public toStatus(
    entries: readonly StatusEntry[],
    fingerprint: string,
    operation: GitOperation | null,
    remote: GitRemote | null,
    uncheckedLfsFiles: number,
    upstreamId: string | null,
    fetchedAt: string | null): GitStatus {
    const upstream = this.upstream === null ? null : new StatusUpstream(this.upstream.name, this.upstream.ahead, this.upstream.behind, this.upstream.gone, upstreamId);
    return new GitStatus(this.branch, this.head, upstream, entries, this.truncated, fingerprint, operation, remote, uncheckedLfsFiles, fetchedAt);
  }
}
