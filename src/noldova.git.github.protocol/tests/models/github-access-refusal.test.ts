/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";

import { describe, it } from "vitest";

import { GitHubAccessRefusal } from "../../src/api/index.ts";

describe("GitHubAccessRefusal", () => {
  it("holds why there is no token, and no token, so a module that takes only types tells it from a grant by its missing token", () => {
    const refusal: GitHubAccessRefusal = new GitHubAccessRefusal("Sign in to GitHub in Settings, GitHub.");

    assert.deepEqual([refusal.reason, Object.keys(refusal), "token" in refusal], ["Sign in to GitHub in Settings, GitHub.", ["reason"], false]);
  });
});
