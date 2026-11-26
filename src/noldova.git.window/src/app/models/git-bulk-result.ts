/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { GitBulkOutcome } from "./git-bulk-outcome.ts";

export class GitBulkResult {
  public readonly done: readonly string[];
  public readonly skipped: readonly GitBulkOutcome[];
  public readonly failed: readonly GitBulkOutcome[];

  public constructor(done: readonly string[], skipped: readonly GitBulkOutcome[], failed: readonly GitBulkOutcome[]) {
    this.done = done;
    this.skipped = skipped;
    this.failed = failed;
  }
}
