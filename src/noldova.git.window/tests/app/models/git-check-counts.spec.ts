/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { describe, expect, it } from "vitest";

import { GitCheckCounts } from "../../../src/app/models/git-check-counts.ts";

describe("GitCheckCounts", () => {
  it("holds the checks that passed, are failing and are pending, with none for no checks", () => {
    const counts: GitCheckCounts = new GitCheckCounts(3, 1, 2);

    expect([counts.passed, counts.failing, counts.pending, GitCheckCounts.NONE.passed, GitCheckCounts.NONE.failing, GitCheckCounts.NONE.pending])
      .toEqual([3, 1, 2, 0, 0, 0]);
  });
});
