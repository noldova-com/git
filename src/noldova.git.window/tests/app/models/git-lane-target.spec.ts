/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { describe, expect, it } from "vitest";

import { GitLaneTarget } from "../../../src/app/models/git-lane-target.ts";

describe("GitLaneTarget", () => {
  it("holds the lane a line runs to and its color", () => {
    const value: GitLaneTarget = new GitLaneTarget(3, 5);

    expect([value.lane, value.color]).toEqual([3, 5]);
  });
});
