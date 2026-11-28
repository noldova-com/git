/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";

import { describe, it } from "vitest";

import { GitHubRepository } from "../../src/models/github-repository.ts";

describe("GitHubRepository", () => {
  it("reads an owner and repository path, with or without .git", () => {
    const repositories = [GitHubRepository.parse("github.com", "octocat/hello-world"), GitHubRepository.parse("github.com", "octocat/hello-world.git"), GitHubRepository.parse("github.com", "octo-cat/a.b_c")];

    assert.deepEqual(repositories.map(t => [t?.owner, t?.name]), [["octocat", "hello-world"], ["octocat", "hello-world"], ["octo-cat", "a.b_c"]]);
  });

  it("refuses a path that isn't one owner and one repository GitHub can have", () => {
    const paths = ["octocat", "octocat/tools/hello-world", "octocat/..", "octocat/.", "octo cat/hello-world", "/hello-world", "octocat/", ""];

    assert.deepEqual(paths.map(t => GitHubRepository.parse("github.com", t)), paths.map(() => null));
  });

  it("builds the repository's API path under /repos", () => {
    assert.equal(GitHubRepository.parse("github.com", "octocat/hello-world")?.pathOf("pulls/2"), "/repos/octocat/hello-world/pulls/2");
  });
});
