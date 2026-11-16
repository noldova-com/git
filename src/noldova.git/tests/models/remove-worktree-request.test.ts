/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";
import { describe, test } from "vitest";

import { RiskLevel, WorktreeRecord } from "@noldova/git.protocol";

import { ChangedPaths } from "../../src/models/changed-paths.ts";
import { RemoveWorktreeRequest } from "../../src/models/remove-worktree-request.ts";

describe("RemoveWorktreeRequest", () => {
  const HEAD = "0123456789abcdef0123456789abcdef01234567";
  const record = new WorktreeRecord("k", "/r", "/w/1f", "noldova/1f", HEAD);
  const changes = new ChangedPaths(["a.txt"], false, "d");

  test("carries the action, its risk, the scope and session, the worktree and its target state", () => {
    const request = new RemoveWorktreeRequest({ scope: "s", sessionId: "agent-1" }, record, HEAD, changes);

    assert.deepEqual({ ...request }, {
      requester: "git",
      action: "git.removeWorktree",
      risk: RiskLevel.LocalDestructive,
      scope: "s",
      sessionId: "agent-1",
      worktree: "/w/1f",
      branch: "noldova/1f",
      head: HEAD,
      changes,
      snapshot: null
    });
  });

  test("has no session for an app call with no agent session", () => {
    assert.equal(new RemoveWorktreeRequest({ scope: "s" }, record, HEAD, changes).sessionId, null);
  });

  test("is current only while HEAD and the digest of the changes stay the same", () => {
    const request = new RemoveWorktreeRequest({ scope: "s" }, record, HEAD, changes);

    assert.equal(request.isCurrent(HEAD, new ChangedPaths(["a.txt"], false, "d")), true);
    assert.equal(request.isCurrent("f".repeat(40), changes), false);
    assert.equal(request.isCurrent(HEAD, new ChangedPaths(["a.txt", "b.txt"], false, "e")), false);
  });
});
