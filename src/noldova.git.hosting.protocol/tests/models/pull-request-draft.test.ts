/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";

import { describe, it } from "vitest";

import { HostingArgumentException, HostingFieldException, PullRequestDraft } from "../../src/api/index.ts";

const draft: PullRequestDraft = new PullRequestDraft("git-github", "octocat/hello-world", "feature/readme", "main", "Update the readme",
  "Explains how to build.", true);

function make(headBranch: string, baseBranch: string, title: string): PullRequestDraft {
  return new PullRequestDraft("git-github", "octocat/hello-world", headBranch, baseBranch, title, "", false);
}

describe("PullRequestDraft", () => {
  it("returns its parts as JSON that reads back the same", () => {
    assert.deepEqual(draft.toJson(), {
      host: "git-github",
      path: "octocat/hello-world",
      headBranch: "feature/readme",
      baseBranch: "main",
      title: "Update the readme",
      body: "Explains how to build.",
      isDraft: true
    });
    assert.deepEqual(PullRequestDraft.fromJson(JSON.parse(JSON.stringify(draft.toJson()))), draft);
  });

  it("takes an empty body for a pull request that isn't a draft", () => {
    const plain: PullRequestDraft = make("feature/readme", "main", "Update the readme");

    assert.deepEqual([plain.body, plain.isDraft], ["", false]);
    assert.deepEqual(PullRequestDraft.fromJson(plain.toJson()), plain);
  });

  it("refuses a blank host, path, branch or title, naming the parameter", () => {
    assert.throws(() => new PullRequestDraft(" ", "octocat/hello-world", "feature/readme", "main", "Update the readme", "", false), HostingArgumentException);
    assert.throws(() => new PullRequestDraft(" ", "octocat/hello-world", "feature/readme", "main", "Update the readme", "", false), { name: "HostingArgumentException", parameterName: "host" });
    assert.throws(() => new PullRequestDraft("git-github", "", "feature/readme", "main", "Update the readme", "", false), { name: "HostingArgumentException", parameterName: "path" });
    assert.throws(() => make(" ", "main", "Update the readme"), { name: "HostingArgumentException", parameterName: "headBranch" });
    assert.throws(() => make("feature/readme", "", "Update the readme"), { name: "HostingArgumentException", parameterName: "baseBranch" });
    assert.throws(() => make("feature/readme", "main", "\n"), { name: "HostingArgumentException", parameterName: "title" });
  });

  it("refuses a base branch that is the head branch, naming the base branch", () => {
    assert.throws(() => make("main", "main", "Update the readme"),
      { name: "HostingArgumentException", parameterName: "baseBranch", message: "The argument baseBranch is invalid: expected a branch other than the head branch." });
    assert.throws(() => PullRequestDraft.fromJson({ ...draft.toJson(), baseBranch: "feature/readme" }), { name: "HostingFieldException", field: "$.baseBranch" });
  });

  it("refuses a path with a '.' or '..' name or characters outside a host's names", () => {
    for (const path of ["..", "../user", "octocat/..", "octocat/hello world"])
      assert.throws(() => new PullRequestDraft("github.com", path, "fix-bug", "main", "Fix the bug", "", false), { name: "HostingArgumentException", parameterName: "path" }, path);
    assert.throws(() => PullRequestDraft.fromJson({ host: "github.com", path: "../user", headBranch: "fix-bug", baseBranch: "main", title: "Fix the bug", body: "",
      isDraft: false }), { name: "HostingFieldException", field: "$.path" });
  });

  it("refuses JSON with a field it doesn't define, out of its range or of another type, naming the field by its path", () => {
    const json = draft.toJson();

    assert.throws(() => PullRequestDraft.fromJson({ ...json, reviewers: ["hubot"] }), HostingFieldException);
    assert.throws(() => PullRequestDraft.fromJson({ ...json, reviewers: ["hubot"] }), { name: "HostingFieldException", field: "$.reviewers" });
    assert.throws(() => PullRequestDraft.fromJson({ ...json, title: " " }, "$.draft"), { name: "HostingFieldException", field: "$.draft.title" });
    assert.throws(() => PullRequestDraft.fromJson({ ...json, isDraft: "true" }), { name: "JsonException", path: "$.isDraft" });
    assert.throws(() => PullRequestDraft.fromJson({ ...json, body: null }), { name: "JsonException", path: "$.body" });
  });
});
