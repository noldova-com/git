/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { describe, expect, it } from "vitest";

import { GitCounts } from "../../../src/app/services/git-counts.ts";

describe("GitCounts", () => {
  it("writes the host windows' counts as the Git view does, a word from one to nine and digits otherwise, capitalized where a sentence starts", () => {
    expect([2, 10].map(t => GitCounts.format(t))).toEqual(["two", "10"]);
    expect([4, 11].map(t => GitCounts.formatStart(t))).toEqual(["Four", "11"]);
  });
});
