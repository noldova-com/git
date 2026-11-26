/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";

import { describe, test } from "vitest";

import { GitRemote, RemoteTransport, StatusUpstream } from "@noldova/git.protocol";

import { PushTarget } from "../../src/models/push-target.ts";

describe("PushTarget", () => {
  test("keeps the branch, its commit, the remote, the upstream and the excluded revisions", () => {
    const remote = new GitRemote("origin", "host", "a/b", RemoteTransport.Https);
    const upstream = new StatusUpstream("origin/main", 1, 0, false);
    const target = new PushTarget("main", "a".repeat(40), remote, upstream, ["^refs/remotes/origin/main"]);

    assert.deepEqual([target.branch, target.head, target.remote, target.tracked, target.excluded], ["main", "a".repeat(40), remote, upstream, ["^refs/remotes/origin/main"]]);
  });
});
