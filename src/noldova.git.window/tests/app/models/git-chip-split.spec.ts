/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { describe, expect, it } from "vitest";

import { GitChipSplit } from "../../../src/app/models/git-chip-split.ts";
import { GitRefChip } from "../../../src/app/models/git-ref-chip.ts";

describe("GitChipSplit", () => {
  it("holds the labels a row shows and those its +N label lists", () => {
    const main: GitRefChip = new GitRefChip("main", "commit", false, true, "main");
    const tag: GitRefChip = new GitRefChip("v1", "sell", true, false);
    const value: GitChipSplit = new GitChipSplit([main], [tag]);

    expect([value.shown, value.hidden]).toEqual([[main], [tag]]);
  });
});
