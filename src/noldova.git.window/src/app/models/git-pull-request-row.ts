/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

export class GitPullRequestRow {
  public readonly key: string;
  public readonly label: string;
  public readonly title: string;
  public readonly url: string;
  public readonly isDraft: boolean;
  public readonly approvals: number;
  public readonly passed: number;
  public readonly failing: number;
  public readonly pending: number;
  public readonly headBranch: string;
  public readonly baseBranch: string | null;
  public readonly account: string | null;

  public constructor(key: string, label: string, title: string, url: string, isDraft: boolean, approvals: number, passed: number, failing: number, pending: number,
    headBranch: string, baseBranch: string | null = null, account: string | null = null) {
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
    this.account = account;
  }
}
