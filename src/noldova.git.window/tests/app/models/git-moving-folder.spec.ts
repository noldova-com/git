/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { describe, expect, it } from "vitest";

import { GitMovingFolder } from "../../../src/app/models/git-moving-folder.ts";

describe("GitMovingFolder", () => {
  it("holds a moving folder and its place before the move", () => {
    const value: GitMovingFolder = new GitMovingFolder("/work/a", 2);

    expect([value.folder, value.index]).toEqual(["/work/a", 2]);
  });
});
