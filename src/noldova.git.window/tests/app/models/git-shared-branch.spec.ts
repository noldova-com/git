/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { signal } from "@angular/core";
import { describe, expect, it } from "vitest";

import { GitSharedBranch } from "../../../src/app/models/git-shared-branch.ts";
import { GitWorkspaceRow } from "../../../src/app/models/git-workspace-row.ts";

describe("GitSharedBranch", () => {
  it("keeps a branch with every workspace row that has it checked out, in their order", () => {
    const rows: readonly GitWorkspaceRow[] = ["/work/site", "/work/site-agents/blame"].map(t => new GitWorkspaceRow(t, signal(null), signal(undefined),
      signal(false)));
    const shared: GitSharedBranch = new GitSharedBranch("feature/blame", rows);

    expect([shared.branch, shared.rows.map(t => t.folder)]).toEqual(["feature/blame", ["/work/site", "/work/site-agents/blame"]]);
  });
});
