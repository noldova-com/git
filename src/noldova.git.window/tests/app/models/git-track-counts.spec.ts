/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { describe, expect, it } from "vitest";

import { GitTrackCounts } from "../../../src/app/models/git-track-counts.ts";

describe("GitTrackCounts", () => {
  it("holds the commits ahead and behind, with none for no branch", () => {
    const counts: GitTrackCounts = new GitTrackCounts(4, 1);

    expect([counts.ahead, counts.behind, GitTrackCounts.NONE.ahead, GitTrackCounts.NONE.behind]).toEqual([4, 1, 0, 0]);
  });
});
