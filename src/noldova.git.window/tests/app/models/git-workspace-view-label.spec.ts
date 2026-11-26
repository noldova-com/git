/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { describe, expect, it } from "vitest";

import { GitWorkspaceViewLabel } from "../../../src/app/models/git-workspace-view-label.ts";

describe("GitWorkspaceViewLabel", () => {
  it("holds a view's icon and name", () => {
    const value: GitWorkspaceViewLabel = new GitWorkspaceViewLabel("sync_problem", "Behind their upstream");

    expect([value.icon, value.name]).toEqual(["sync_problem", "Behind their upstream"]);
  });
});
