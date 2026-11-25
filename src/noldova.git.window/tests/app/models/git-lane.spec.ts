/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { describe, expect, it } from "vitest";

import { GitLane } from "../../../src/app/models/git-lane.ts";

describe("GitLane", () => {
  it("holds what a lane waits for, its color and side, and frees it keeping its color and side", () => {
    const lane: GitLane = new GitLane("c".repeat(40), 3, true);
    const freed: GitLane = lane.freed();

    expect([lane.waiting, lane.color, lane.isSide, freed.waiting, freed.color, freed.isSide]).toEqual(["c".repeat(40), 3, true, null, 3, true]);
  });
});
