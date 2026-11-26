/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { describe, expect, it } from "vitest";

import { GitGraphLine } from "../../../src/app/models/git-graph-line.ts";

describe("GitGraphLine", () => {
  it("holds the stroke's lanes, whether each end is at the row's middle, and its color", () => {
    const line: GitGraphLine = new GitGraphLine(0, true, 2, false, 5);

    expect([line.fromLane, line.fromMiddle, line.toLane, line.toMiddle, line.color]).toEqual([0, true, 2, false, 5]);
  });
});
