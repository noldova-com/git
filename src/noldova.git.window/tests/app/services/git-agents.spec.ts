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
import { GitAgents } from "../../../src/app/services/git-agents.ts";

describe("GitAgents", () => {
  const providerOf = (): IGitAgents => ({ listFor: () => signal(null), open: () => undefined });

  it("gives every provider in the order they were given, and drops each once it is removed", () => {
    const first: IGitAgents = providerOf();
    const second: IGitAgents = providerOf();
    const removeFirst: () => void = GitAgents.provide(first);
    const removeSecond: () => void = GitAgents.provide(second);

    const found: (readonly IGitAgents[])[] = [GitAgents.all()];
    removeFirst();
    found.push(GitAgents.all());
    removeSecond();
    found.push(GitAgents.all());

    expect(found).toEqual([[first, second], [second], []]);
  });
});

describe("GitAgentRow", () => {
  it("holds a run's key, name, state and worktree", () => {
    const row: GitAgentRow = new GitAgentRow("run-1", "Blame gutter", GitAgentState.WaitingForYou, "/work/site-agents/blame");

    expect([row.key, row.name, row.state, row.worktree]).toEqual(["run-1", "Blame gutter", "WaitingForYou", "/work/site-agents/blame"]);
  });
});
