/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { describe, expect, it } from "vitest";

import { GitWorkspaceView } from "../../../src/app/enums/git-workspace-view.ts";
import { GitWorkspaceViewCount } from "../../../src/app/models/git-workspace-view-count.ts";

describe("GitWorkspaceViewCount", () => {
  it("holds a view and how many repositories it holds", () => {
    const value: GitWorkspaceViewCount = new GitWorkspaceViewCount(GitWorkspaceView.Behind, 2);

    expect([value.view, value.count]).toEqual([GitWorkspaceView.Behind, 2]);
  });
});
