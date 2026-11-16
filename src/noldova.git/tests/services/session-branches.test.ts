/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */
import assert from "node:assert/strict";

import { describe, test } from "vitest";

import { SessionBranches } from "../../src/services/session-branches.ts";

describe("SessionBranches", () => {
  test("knows a branch only as the session's that made it, in the repository it made it in", () => {
    const branches = new SessionBranches();
    branches.add("session-1", "/repo", "feature");

    assert.equal(branches.has("session-1", "/repo", "feature"), true);
    assert.equal(branches.has("session-2", "/repo", "feature"), false);
    assert.equal(branches.has("session-1", "/other", "feature"), false);
    assert.equal(branches.has("session-1", "/repo", "main"), false);
  });
});
