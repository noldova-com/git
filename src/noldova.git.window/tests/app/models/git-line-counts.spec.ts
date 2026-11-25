/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { describe, expect, it } from "vitest";

import { GitLineCounts } from "../../../src/app/models/git-line-counts.ts";

describe("GitLineCounts", () => {
  it("holds the lines added and removed, and adds another diff's to them", () => {
    const sum: GitLineCounts = GitLineCounts.NONE.plus(new GitLineCounts(3, 1)).plus(new GitLineCounts(2, 5));

    expect([sum.added, sum.removed, GitLineCounts.NONE.added, GitLineCounts.NONE.removed]).toEqual([5, 6, 0, 0]);
  });
});
