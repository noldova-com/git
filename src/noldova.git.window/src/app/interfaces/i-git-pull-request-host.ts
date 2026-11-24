/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { HostReference } from "@noldova/git.hosting.protocol";

/** What a host module gives a pull request page's Commits, Files and Conflicts tabs and its comment threads, which the Git module draws the same way for every host. */
export interface IGitPullRequestHost {
  /** The host's name as the tabs show it, such as `Azure DevOps`. */
  readonly name: string;
  /** The method that answers a pull request's commits as `HostPullRequestCommits`, asked with its `HostReference`. */
  readonly readCommitsMethod: string;
  /** The method that answers the files a pull request's latest push changes as `HostPullRequestFiles`, asked with its `HostReference`. */
  readonly readChangesMethod: string;
  /** The method that answers the paths that keep a pull request from merging as `HostPullRequestConflicts`, asked with its `HostReference`. */
  readonly readConflictsMethod: string;
  /** The method that answers a pull request's comment threads as `HostPullRequestThreads`, asked with its `HostReference`. */
  readonly readThreadsMethod: string;
  /** The method that replies to a thread and answers the reply as a `HostComment`, or `null` for a host that can't, which shows no Reply. */
  readonly replyToThreadMethod: string | null;
  /** The method that resolves or reactivates a thread, or `null` for a host that keeps no thread state, which shows no Resolve or Reactivate. */
  readonly changeThreadMethod: string | null;

  /** The open repository's folder when it is the pull request's own repository; `null` otherwise, or when the host can't tell. */
  localFolderAsync(pullRequestUrl: string): Promise<string | null>;

  /** A commit's page on the host, which the Commits tab opens when the open repository can't show the commit. */
  commitPageOf(pullRequestUrl: string, commitId: string): string;

  /**
   * A comment author's picture, read inside a computed signal: `null` when the host has none, or `undefined` while it is still reading. The reference
   * names the pull request, such as for Azure DevOps's organization; a host that finds people by login alone may ignore it.
   */
  personAvatarOf(reference: HostReference, login: string): string | null | undefined;
}
