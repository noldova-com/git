/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { describe, expect, it } from "vitest";

import { GitBulkOutcome } from "../../../src/app/models/git-bulk-outcome.ts";

describe("GitBulkOutcome", () => {
  it("keeps the repository and the reason it was skipped or failed", () => {
    const outcome: GitBulkOutcome = new GitBulkOutcome("site", "No upstream to push to.");

    expect([outcome.repository, outcome.reason]).toEqual(["site", "No upstream to push to."]);
  });
});
