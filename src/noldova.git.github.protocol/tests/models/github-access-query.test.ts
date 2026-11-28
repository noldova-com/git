/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";

import { describe, it } from "vitest";

import { GitHubAccessQuery } from "../../src/api/index.ts";

describe("GitHubAccessQuery", () => {
  it("holds the repository's host and path, and a checkout's folder and remote name, which default to none", () => {
    const query: GitHubAccessQuery = new GitHubAccessQuery("github.com", "octocat/hello-world", "/home/kim/hello-world", "upstream");
    const bare: GitHubAccessQuery = new GitHubAccessQuery("github.com", "octocat/hello-world");

    assert.deepEqual([query.host, query.path, query.folder, query.remote], ["github.com", "octocat/hello-world", "/home/kim/hello-world", "upstream"]);
    assert.deepEqual([bare.folder, bare.remote], [null, null]);
  });
});
