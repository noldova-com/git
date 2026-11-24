/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { GitRemote, GitStatus } from "@noldova/git.protocol";

import { GitFileGroupKind } from "../enums/git-file-group-kind.ts";
import { GitFileGroup } from "./git-file-group.ts";

/** A repository's branch, how far it is from its upstream and its changes, as a workspace's row shows them. */
export class GitRepositorySummary {
  public readonly folder: string;
  public readonly branch: string | null;
  public readonly head: string | null;
  public readonly upstream: string | null;
  /** The remote of the branch's upstream, where its pull requests are, or null without one. */
  public readonly remote: GitRemote | null;
  public readonly ahead: number;
  public readonly behind: number;
  public readonly gone: boolean;
  public readonly staged: number;
  public readonly changed: number;
  public readonly conflicts: number;
  public readonly files: number;
  public readonly isTruncated: boolean;
  /** When the repository last fetched, from its `FETCH_HEAD`, or null when it never has. */
  public readonly fetchedAt: string | null;
  public readonly isFetching: boolean;
  public readonly failure: string | null;
  private readonly status: GitStatus | null;

  public constructor(folder: string, status: GitStatus | null, isFetching: boolean, failure: string | null) {
    const groups: readonly GitFileGroup[] = GitFileGroup.groupsOf(status?.entries ?? []);
    const countOf = (kind: GitFileGroupKind): number => groups.find(t => t.kind === kind)?.rows.length ?? 0;
    this.folder = folder;
    this.status = status;
    this.branch = status?.branch ?? null;
    this.head = status?.head ?? null;
    this.upstream = status?.upstream?.name ?? null;
    this.remote = status?.remote ?? null;
    this.ahead = status?.upstream?.ahead ?? 0;
    this.behind = status?.upstream?.behind ?? 0;
    this.gone = status?.upstream?.gone ?? false;
    this.staged = countOf(GitFileGroupKind.Staged);
    this.changed = countOf(GitFileGroupKind.Changes);
    this.conflicts = countOf(GitFileGroupKind.Conflicts);
    this.files = new Set(groups.flatMap(t => t.rows.map(row => row.path))).size;
    this.isTruncated = status?.truncated ?? false;
    this.fetchedAt = status?.fetchedAt ?? null;
    this.isFetching = isFetching;
    this.failure = failure;
  }

  /** Whether no read of the repository has succeeded yet, so its branch, upstream and changes are unknown. */
  public get isUnread(): boolean {
    return this.status === null;
  }

  public asFetching(): GitRepositorySummary {
    return new GitRepositorySummary(this.folder, this.status, true, null);
  }

  public withFailure(failure: string): GitRepositorySummary {
    return new GitRepositorySummary(this.folder, this.status, false, failure);
  }
}
