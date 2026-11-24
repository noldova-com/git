/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

/** One open pull request as the repository panel lists it: its label, title and page, and the counts its status dot and note come from. */
export class GitPullRequestRow {
  /** The host's own key for it, such as its id; the window never reads it, and gives it back to the host's open(). */
  public readonly key: string;
  /** The host's label for it, such as "#214" or "!482". */
  public readonly label: string;
  public readonly title: string;
  /** Its page on the host, which a click opens unless the host opens it itself. */
  public readonly url: string;
  public readonly isDraft: boolean;
  public readonly approvals: number;
  /** Its checks that passed, failed, and still run or wait. */
  public readonly passed: number;
  public readonly failing: number;
  public readonly pending: number;
  /** The branch it merges from, such as "feature/sign-in", which the workspace matches with a repository's current branch. */
  public readonly headBranch: string;
  /** The branch it merges into, such as "main", or null when the host didn't say; the workspace finds a pull request stacked on another by it. */
  public readonly baseBranch: string | null;

  public constructor(key: string, label: string, title: string, url: string, isDraft: boolean, approvals: number, passed: number, failing: number, pending: number,
    headBranch: string, baseBranch: string | null = null) {
    this.key = key;
    this.label = label;
    this.title = title;
    this.url = url;
    this.isDraft = isDraft;
    this.approvals = approvals;
    this.passed = passed;
    this.failing = failing;
    this.pending = pending;
    this.headBranch = headBranch;
    this.baseBranch = baseBranch;
  }
}
