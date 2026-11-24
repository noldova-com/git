/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { describe, expect, it } from "vitest";

import { GitSwitchTarget } from "../../../src/app/models/git-switch-target.ts";

describe("GitSwitchTarget", () => {
  it("holds the repository's folder and the branch the switch moves to", () => {
    const target: GitSwitchTarget = new GitSwitchTarget("/work/project", "feature/view");

    expect([target.folder, target.branch]).toEqual(["/work/project", "feature/view"]);
  });
});
