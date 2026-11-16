/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";

import { describe, it } from "vitest";

import { BranchPullRequest, CheckState, HostChanges, HostCheck, HostingArgumentException, HostingFieldException, HostItem, HostPerson, HostReference,
  ReferenceKind, ReferenceState } from "../../src/api/index.ts";

const commit: string = "6dcb09b5b57875f334f61aebed695e2e4193db5e";
const pullRequest: HostItem = new HostItem(new HostReference("git-github", "octocat", "hello-world", 1), ReferenceKind.PullRequest, ReferenceState.Draft,
  "Update the readme", "https://github.com/octocat/hello-world/pull/1", new HostPerson("monalisa", null, null),
  1_800_000_000_000, null, 0, new HostChanges(1, 0, 1, "feature/readme", "main", commit));
const issue: HostItem = new HostItem(new HostReference("git-github", "octocat", "hello-world", 2), ReferenceKind.Issue, ReferenceState.Open,
  "Found a bug", "https://github.com/octocat/hello-world/issues/2", null, 1_800_000_000_000, null, 0, null);
const build: HostCheck = new HostCheck("build", CheckState.Succeeded, "https://github.com/octocat/hello-world/actions/runs/1");
const lint: HostCheck = new HostCheck("lint", CheckState.Running, null);

function check(state: CheckState): HostCheck {
  return new HostCheck(state, state, null);
}

function stateOf(...states: readonly CheckState[]): CheckState | null {
  return new BranchPullRequest(pullRequest, states.map(check)).checksState;
}

describe("BranchPullRequest", () => {
  it("returns a pull request with its checks as JSON that reads back the same", () => {
    const found: BranchPullRequest = new BranchPullRequest(pullRequest, [build, lint]);

    assert.deepEqual(found.toJson(), {
      pullRequest: pullRequest.toJson(),
      checks: [
        { name: "build", state: "Succeeded", url: "https://github.com/octocat/hello-world/actions/runs/1" },
        { name: "lint", state: "Running", url: null }
      ]
    });
    assert.deepEqual(BranchPullRequest.fromJson(JSON.parse(JSON.stringify(found.toJson()))), found);
  });

  it("takes no pull request and no checks for a branch without one, and returns it as JSON that reads back the same", () => {
    const none: BranchPullRequest = new BranchPullRequest(null, []);

    assert.deepEqual(none.toJson(), { pullRequest: null, checks: [] });
    assert.deepEqual(BranchPullRequest.fromJson(none.toJson()), none);
    assert.equal(none.checksState, null);
  });

  it("refuses an issue in place of the pull request, naming the pull request", () => {
    assert.throws(() => new BranchPullRequest(issue, []), HostingArgumentException);
    assert.throws(() => new BranchPullRequest(issue, []),
      { name: "HostingArgumentException", parameterName: "pullRequest", message: "The argument pullRequest is invalid: expected a pull request." });
    assert.throws(() => BranchPullRequest.fromJson({ pullRequest: issue.toJson(), checks: [] }), { name: "HostingFieldException", field: "$.pullRequest" });
  });

  it("refuses checks without a pull request, naming the checks", () => {
    assert.throws(() => new BranchPullRequest(null, [build]),
      { name: "HostingArgumentException", parameterName: "checks", message: "The argument checks is invalid: expected no checks, since there is no pull request." });
    assert.throws(() => BranchPullRequest.fromJson({ pullRequest: null, checks: [build.toJson()] }), { name: "HostingFieldException", field: "$.checks" });
  });

  it("keeps its own copy of the checks", () => {
    const checks: HostCheck[] = [build];
    const kept: BranchPullRequest = new BranchPullRequest(pullRequest, checks);
    checks.push(lint);

    assert.deepEqual(kept.checks, [build]);
  });

  it("sums up its checks by the worst state among them", () => {
    assert.equal(stateOf(), null);
    assert.equal(stateOf(CheckState.Neutral), CheckState.Neutral);
    assert.equal(stateOf(CheckState.Neutral, CheckState.Succeeded), CheckState.Succeeded);
    assert.equal(stateOf(CheckState.Succeeded, CheckState.Queued, CheckState.Neutral), CheckState.Queued);
    assert.equal(stateOf(CheckState.Queued, CheckState.Running, CheckState.Succeeded), CheckState.Running);
    assert.equal(stateOf(CheckState.Running, CheckState.Succeeded, CheckState.Failed, CheckState.Queued, CheckState.Neutral), CheckState.Failed);
  });

  it("refuses JSON with a field it doesn't define, naming the field by its path", () => {
    const json = new BranchPullRequest(pullRequest, [build]).toJson();

    assert.throws(() => BranchPullRequest.fromJson({ ...json, branch: "feature/readme" }), HostingFieldException);
    assert.throws(() => BranchPullRequest.fromJson({ ...json, branch: "feature/readme" }), { name: "HostingFieldException", field: "$.branch" });
    assert.throws(() => BranchPullRequest.fromJson({ ...json, checks: [{ ...build.toJson(), summary: "x" }] }), { name: "HostingFieldException", field: "$.checks.0.summary" });
  });

  it("names the path of a bad field in its pull request or one of its checks", () => {
    const json = new BranchPullRequest(pullRequest, [build, lint]).toJson();
    const author = { login: "", avatar: null, url: null };

    assert.throws(() => BranchPullRequest.fromJson({ ...json, pullRequest: { ...pullRequest.toJson(), author } }), { name: "HostingFieldException", field: "$.pullRequest.author.login" });
    assert.throws(() => BranchPullRequest.fromJson({ ...json, checks: [build.toJson(), { ...lint.toJson(), name: " " }] }), { name: "HostingFieldException", field: "$.checks.1.name" });
    assert.throws(() => BranchPullRequest.fromJson({ ...json, checks: [build.toJson(), "lint"] }), { name: "JsonException", path: "$.checks.1" });
    assert.throws(() => BranchPullRequest.fromJson({ ...json, checks: null }), { name: "JsonException", path: "$.checks" });
  });
});
