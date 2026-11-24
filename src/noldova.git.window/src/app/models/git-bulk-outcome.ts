/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

/** One repository of a bulk push or pull that was skipped or failed, with why. */
export class GitBulkOutcome {
  public readonly repository: string;
  public readonly reason: string;

  public constructor(repository: string, reason: string) {
    this.repository = repository;
    this.reason = reason;
  }
}
