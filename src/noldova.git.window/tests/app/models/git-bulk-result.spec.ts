/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { describe, expect, it } from "vitest";

import { GitBulkOutcome } from "../../../src/app/models/git-bulk-outcome.ts";
import { GitBulkResult } from "../../../src/app/models/git-bulk-result.ts";

describe("GitBulkResult", () => {
  it("keeps the repositories done, skipped and failed apart, in their order", () => {
    const skipped: readonly GitBulkOutcome[] = [new GitBulkOutcome("docs", "Nothing to push.")];
    const failed: readonly GitBulkOutcome[] = [new GitBulkOutcome("api", "Rejected."), new GitBulkOutcome("web", "Offline.")];
    const result: GitBulkResult = new GitBulkResult(["site", "tools"], skipped, failed);

    expect([result.done, result.skipped, result.failed]).toEqual([["site", "tools"], skipped, failed]);
  });

  it("keeps an empty result for a run with nothing in it", () => {
    const result: GitBulkResult = new GitBulkResult([], [], []);

    expect([result.done, result.skipped, result.failed]).toEqual([[], [], []]);
  });
});
