/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { describe, expect, it } from "vitest";

import { GitAgentState } from "../../../src/app/enums/git-agent-state.ts";
import { GitAgentRow } from "../../../src/app/models/git-agent-row.ts";

describe("GitAgentRow", () => {
  it("holds the run's key, its task's name, where it stands and its worktree", () => {
    const row: GitAgentRow = new GitAgentRow("run-7", "Blame gutter", GitAgentState.WaitingForYou, "/work/project-blame");

    expect([row.key, row.name, row.state, row.worktree]).toEqual(["run-7", "Blame gutter", GitAgentState.WaitingForYou, "/work/project-blame"]);
  });
});
