/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";

import { describe, it } from "vitest";

import { HostReference } from "@noldova/git.hosting.protocol";

import { GitHubRepository } from "../../src/models/github-repository.ts";

describe("GitHubRepository", () => {
  it("reads an owner and repository path, with or without .git, on its host in lowercase", () => {
    const repositories = [GitHubRepository.parse("github.com", "octocat/hello-world"), GitHubRepository.parse("github.com", "octocat/hello-world.git"),
      GitHubRepository.parse("GHE.Example.com:8443", "octo-cat/a.b_c")];

    assert.deepEqual(repositories.map(t => [t?.host, t?.owner, t?.name]), [["github.com", "octocat", "hello-world"], ["github.com", "octocat", "hello-world"],
      ["ghe.example.com:8443", "octo-cat", "a.b_c"]]);
  });

  it("refuses a path that isn't one owner and one repository GitHub can have", () => {
    const paths = ["octocat", "octocat/tools/hello-world", "octocat/..", "octocat/.", "octo cat/hello-world", "/hello-world", "octocat/", ""];

    assert.deepEqual(paths.map(t => GitHubRepository.parse("github.com", t)), paths.map(() => null));
  });

  it("names a GitHub Enterprise server as its references' place and github.com as none, and reads a reference back on that server", () => {
    const enterprise: GitHubRepository | null = GitHubRepository.parse("GHE.Example.com", "octocat/hello-world");
    const github: GitHubRepository | null = GitHubRepository.parse("github.com", "octocat/hello-world");
    const references: readonly HostReference[] = [enterprise, github].map(t => t?.referenceOf(7) ?? new HostReference("none", "none", "none", 1));

    assert.deepEqual(references.map(t => [t.host, t.owner, t.repository, t.number, t.place]),
      [["git-github", "octocat", "hello-world", 7, "ghe.example.com"], ["git-github", "octocat", "hello-world", 7, null]]);
    assert.deepEqual(references.map(t => GitHubRepository.ofReference(t)), [enterprise, github]);
    assert.deepEqual([enterprise?.repositoryPath, GitHubRepository.ofReference(new HostReference("git-gitlab", "octocat", "hello-world", 7))],
      ["octocat/hello-world", null]);
  });

  it("builds the repository's API path under /repos", () => {
    assert.equal(GitHubRepository.parse("github.com", "octocat/hello-world")?.pathOf("pulls/2"), "/repos/octocat/hello-world/pulls/2");
  });
});
