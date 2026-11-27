/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";

import { describe, it } from "vitest";

import { GitHubAccessGrant } from "../../src/api/index.ts";

describe("GitHubAccessGrant", () => {
  it("holds the token and the login, and no reason, so a module that takes only types tells it from a refusal by its token", () => {
    const grant: GitHubAccessGrant = new GitHubAccessGrant("gho_example", "example-user");

    assert.deepEqual([grant.token, grant.login, grant.host, Object.keys(grant), "reason" in grant],
      ["gho_example", "example-user", "github.com", ["token", "login", "host"], false]);
  });

  it("holds the host it is given", () => {
    assert.equal(new GitHubAccessGrant("ghp_example", "example-user", "github.example.com").host, "github.example.com");
  });
});
