/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { signal } from "@angular/core";
import { describe, expect, it } from "vitest";

import { GitAgentState } from "../../../src/app/enums/git-agent-state.ts";
import type { IGitAgents } from "../../../src/app/interfaces/i-git-agents.ts";
import { GitAgentRow } from "../../../src/app/models/git-agent-row.ts";
import { GitWorkspaceRun } from "../../../src/app/models/git-workspace-run.ts";

const agents: IGitAgents = { listFor: () => signal([]), open: () => undefined };

describe("GitWorkspaceRun", () => {
  it("keeps the repository, its agents' provider and the run", () => {
    const row: GitAgentRow = new GitAgentRow("run-1", "Blame gutter", GitAgentState.Working, "/work/site-agents/blame");
    const run: GitWorkspaceRun = new GitWorkspaceRun("/work/site", "site", agents, row);

    expect([run.folder, run.repository, run.provider, run.row]).toEqual(["/work/site", "site", agents, row]);
  });

  it("has its own worktree when the run works in another folder than the repository's, and none when it works in the repository itself", () => {
    const apart: GitWorkspaceRun = new GitWorkspaceRun("/work/site", "site", agents,
      new GitAgentRow("run-1", "Blame gutter", GitAgentState.Working, "/work/site-agents/blame"));
    const inPlace: GitWorkspaceRun = new GitWorkspaceRun("/work/site", "site", agents, new GitAgentRow("run-2", "Docs", GitAgentState.Done, "/work/site"));

    expect([apart.hasOwnWorktree, inPlace.hasOwnWorktree]).toEqual([true, false]);
  });
});
