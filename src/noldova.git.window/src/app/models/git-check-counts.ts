/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

/** A pull request's or a commit's checks: how many passed, are failing and are pending. */
export class GitCheckCounts {
  public static readonly NONE: GitCheckCounts = new GitCheckCounts(0, 0, 0);

  public readonly passed: number;
  public readonly failing: number;
  public readonly pending: number;

  public constructor(passed: number, failing: number, pending: number) {
    this.passed = passed;
    this.failing = failing;
    this.pending = pending;
  }
}
