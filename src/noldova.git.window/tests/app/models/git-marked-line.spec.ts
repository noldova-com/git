/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { describe, expect, it } from "vitest";

import { GitMarkedLine } from "../../../src/app/models/git-marked-line.ts";

describe("GitMarkedLine", () => {
  it("holds the marked line's file and row, and says whether a line is it", () => {
    const marked: GitMarkedLine = new GitMarkedLine("a.ts", 4);

    expect([marked.path, marked.row, marked.isAt("a.ts", 4), marked.isAt("a.ts", 5), marked.isAt("b.ts", 4)]).toEqual(["a.ts", 4, true, false, false]);
  });
});
