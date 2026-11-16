/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";

import { describe, test } from "vitest";

import { UnansweredCallException } from "@noldova/desktop.protocol/testing";
import { WorktreeRecord } from "@noldova/git.protocol";

import { RequestDeniedException } from "../../src/exceptions/request-denied.exception.ts";
import { ChangedPaths } from "../../src/models/changed-paths.ts";
import { RemoveWorktreeRequest } from "../../src/models/remove-worktree-request.ts";
import { PermissionGateFixture } from "./permission-gate.fixture.ts";

describe("PermissionGateFixture", () => {
  const head = "a".repeat(40);
  const request = new RemoveWorktreeRequest({ scope: "project-1" }, new WorktreeRecord("k1", "/r", "/w/1f2e", "noldova/1f2e", head), head, new ChangedPaths(["a.txt"], false, "d"));

  test("answers the requests in the order their answers were queued, and records each request", async () => {
    const gate = new PermissionGateFixture();
    const denied = new RequestDeniedException();
    gate.answerNext(null, denied);

    await gate.requestAsync(request);
    await assert.rejects(gate.requestAsync(request), denied);

    assert.deepEqual(gate.requests, [request, request]);
  });

  test("fails a request nobody queued an answer for, rather than allowing it", async () => {
    await assert.rejects(new PermissionGateFixture().requestAsync(request), (error: unknown) => error instanceof UnansweredCallException);
  });
});
