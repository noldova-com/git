/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";

import { describe, test } from "vitest";

import { StatusUpstream } from "@noldova/git.protocol";

import { PulledBranch } from "../../src/models/pulled-branch.ts";

describe("PulledBranch", () => {
  test("keeps the branch and its upstream", () => {
    const upstream = new StatusUpstream("origin/main", 0, 2, false);
    const pulled = new PulledBranch("main", upstream);

    assert.equal(pulled.branch, "main");
    assert.equal(pulled.upstream, upstream);
  });
});
