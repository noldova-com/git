/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { Signal } from "@angular/core";
import type { GitRemote } from "@noldova/git.protocol";

import type { GitBranchPullRequest } from "../models/git-branch-pull-request.ts";
import type { GitCommitComments } from "../models/git-commit-comments.ts";
import type { GitPullRequestList } from "../models/git-pull-request-list.ts";
import type { GitPullRequestRow } from "../models/git-pull-request-row.ts";

/** What a host module gives the repository panel so that it lists a repository's open pull requests on that host. */
export interface IGitPullRequests {
  /** Whether the remote is on this host; the first host that claims the current branch's remote lists its pull requests. */
  claims(remote: GitRemote): boolean;

  /** The host's name, which the section's header shows, such as "GitHub". */
  readonly hostName: string;

  /** The settings page whose sign-in a signed-out section opens. */
  readonly signInPage: string;

  /**
   * The repository's open pull requests on the remote, or null before the host has any answer.
   * The panel reads it inside a computed signal, so the host answers the same signal for a folder and remote each time and updates it.
   */
  listFor(folder: string, remote: GitRemote): Signal<GitPullRequestList | null>;

  /** Reads them again: the panel asks when the section first shows a folder, when the window takes the focus and on Try again. */
  refresh(folder: string, remote: GitRemote): void;

  /**
   * A branch's newest pull request in any state, with its checks, or its head commit's checks when it has none, or null before the host has
   * any answer; the workspace page reads it inside a computed signal, so the host answers the same signal for a folder, remote, branch and head
   * commit each time and updates it. Without this member, the workspace page finds the branch's pull request in {@link listFor}.
   */
  branchFor?(folder: string, remote: GitRemote, branch: string, headCommit: string | null): Signal<GitBranchPullRequest | null>;

  /** Reads a branch's pull request again: the workspace page asks when the branch's row first shows and when the window takes the focus. */
  refreshBranch?(folder: string, remote: GitRemote, branch: string, headCommit: string | null): void;

  /**
   * The repository's open pull requests with their head and base branches, for finding stacks only, or null before the host has any answer or
   * after a read that failed; for a host with {@link branchFor}, whose {@link listFor} the workspace page doesn't read. Its rows carry no approvals
   * or checks, so nothing shows them. The workspace page reads it inside a computed signal, so the host answers the same signal for a remote each
   * time, reads it when first asked, and forgets a failed read. Without this member, the page finds stacks only for a host without branchFor.
   */
  stackListFor?(folder: string, remote: GitRemote): Signal<GitPullRequestList | null>;

  /**
   * The pull request that brought a commit in, in any state, with its checks; or one with no pull request when none did, or null before the host
   * has any answer, or {@link GitBranchPullRequest.failed} with why when the read fails; a failure is never cached, so it reads again when the
   * commit opens again. The commit's detail reads it inside a computed signal, so the host answers the same signal for a folder, remote and commit
   * each time, reads it when first asked, and updates it. Without this member, the commit's detail shows no pull request.
   */
  commitFor?(folder: string, remote: GitRemote, commitId: string): Signal<GitBranchPullRequest | null>;

  /**
   * The review comments on a commit, or null before the host has any answer or after a read that failed. The commit's detail reads it inside a
   * computed signal, so the host answers the same signal for a remote and commit each time, reads it when first asked, and forgets a failed read,
   * so the next time the detail shows the commit reads it again. Without this member, the commit's detail shows no comments row.
   */
  commentsFor?(folder: string, remote: GitRemote, commitId: string): Signal<GitCommitComments | null>;

  /**
   * The open pull requests on the remote's repository that ask the signed-in person for a review, or null before the host has any answer; keyed by
   * the remote, so the folders of one repository share one read. The workspace page reads it inside a computed signal, so the host answers the same
   * signal for a remote each time and updates it. A row carries no counts or head branch. Without this member, the host shows no review requests.
   */
  reviewsFor?(remote: GitRemote): Signal<GitPullRequestList | null>;

  /** Reads the review requests again: the workspace page asks for each listed repository's remote when it lists them and when the window takes the focus. */
  refreshReviews?(remote: GitRemote): void;

  /**
   * The host's page that opens a new pull request of `source` into `target`, both branches as the remote names them, or null when it has none
   * for them. The history's branch drop opens it in the browser; without this member, or with null, the drop holds its pull request choice.
   */
  newPullRequestUrl?(remote: GitRemote, source: string, target: string): string | null;

  /** Opens a pull request in the host's own page and answers true; false, or no such member, opens its page in the browser. */
  open?(folder: string, row: GitPullRequestRow): boolean;
}
