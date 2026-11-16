/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";

import { describe, it } from "vitest";

import { HostChanges, HostingArgumentException, HostingFieldException, HostItem, HostPerson, HostReference, ReferenceKind, ReferenceState } from "../../src/api/index.ts";

const commit: string = "6dcb09b5b57875f334f61aebed695e2e4193db5e";
const avatar: string = "data:image/png;base64,iVBORw0KGgo=";
const reference: HostReference = new HostReference("git-github", "octocat", "hello-world", 1);
const author: HostPerson = new HostPerson("octocat", avatar, null);
const changes: HostChanges = new HostChanges(12, 3, 2, "feature/readme", "main", commit);
const pullRequest: HostItem = new HostItem(reference, ReferenceKind.PullRequest, ReferenceState.Open, "Update the readme",
  "https://github.com/octocat/hello-world/pull/1", author, 1_800_000_000_000, null, 4, changes);
const issue: HostItem = new HostItem(new HostReference("git-github", "octocat", "hello-world", 2), ReferenceKind.Issue, ReferenceState.ClosedDone,
  "Found a bug", "https://github.com/octocat/hello-world/issues/2", null, 1_800_000_000_000, 1_800_000_360_000, 0, null);

function roundTrip(item: HostItem): HostItem {
  return HostItem.fromJson(JSON.parse(JSON.stringify(item.toJson())));
}

function withState(kind: ReferenceKind, state: ReferenceState): HostItem {
  return new HostItem(reference, kind, state, "Update the readme", "https://github.com/octocat/hello-world/pull/1", null, 1,
    state === ReferenceState.Open || state === ReferenceState.Draft ? null : 2, 0, kind === ReferenceKind.PullRequest ? changes : null);
}

describe("HostItem", () => {
  it("returns a pull request with its author and changes as JSON that reads back the same", () => {
    assert.deepEqual(pullRequest.toJson(), {
      reference: { host: "git-github", owner: "octocat", repository: "hello-world", number: 1 },
      kind: "PullRequest",
      state: "Open",
      title: "Update the readme",
      url: "https://github.com/octocat/hello-world/pull/1",
      author: { login: "octocat", avatar, url: null },
      createdAt: 1_800_000_000_000,
      closedAt: null,
      comments: 4,
      changes: { additions: 12, deletions: 3, changedFiles: 2, headBranch: "feature/readme", baseBranch: "main", headCommit: commit }
    });
    assert.deepEqual(roundTrip(pullRequest), pullRequest);
  });

  it("returns an issue with no author and no changes as JSON that reads back the same", () => {
    assert.deepEqual([issue.toJson()["author"], issue.toJson()["closedAt"], issue.toJson()["changes"]], [null, 1_800_000_360_000, null]);
    assert.deepEqual(roundTrip(issue), issue);
  });

  it("takes each state of a pull request and each state of an issue", () => {
    const pullRequestStates: readonly ReferenceState[] = [ReferenceState.Open, ReferenceState.Draft, ReferenceState.Merged, ReferenceState.Closed];
    const issueStates: readonly ReferenceState[] = [ReferenceState.Open, ReferenceState.ClosedDone, ReferenceState.ClosedNotPlanned];

    assert.deepEqual(pullRequestStates.map(t => roundTrip(withState(ReferenceKind.PullRequest, t)).state), pullRequestStates);
    assert.deepEqual(issueStates.map(t => roundTrip(withState(ReferenceKind.Issue, t)).state), issueStates);
  });

  it("refuses an issue's state on a pull request and a pull request's state on an issue, naming the state", () => {
    assert.throws(() => withState(ReferenceKind.PullRequest, ReferenceState.ClosedDone), HostingArgumentException);
    assert.throws(() => withState(ReferenceKind.PullRequest, ReferenceState.ClosedDone),
      { name: "HostingArgumentException", parameterName: "state", message: "The argument state is invalid: expected Open, Draft, Merged or Closed, the states of a pull request." });
    assert.throws(() => withState(ReferenceKind.PullRequest, ReferenceState.ClosedNotPlanned), { name: "HostingArgumentException", parameterName: "state" });
    assert.throws(() => withState(ReferenceKind.Issue, ReferenceState.Draft),
      { name: "HostingArgumentException", parameterName: "state", message: "The argument state is invalid: expected Open, ClosedDone or ClosedNotPlanned, the states of an issue." });
    assert.throws(() => withState(ReferenceKind.Issue, ReferenceState.Merged), { name: "HostingArgumentException", parameterName: "state" });
    assert.throws(() => withState(ReferenceKind.Issue, ReferenceState.Closed), { name: "HostingArgumentException", parameterName: "state" });
    assert.throws(() => HostItem.fromJson({ ...issue.toJson(), state: "Draft" }), { name: "HostingFieldException", field: "$.state" });
  });

  it("takes changes exactly for a pull request, naming the changes", () => {
    assert.throws(() => new HostItem(reference, ReferenceKind.PullRequest, ReferenceState.Open, "Update the readme",
      "https://github.com/octocat/hello-world/pull/1", null, 1, null, 0, null),
    { name: "HostingArgumentException", parameterName: "changes", message: "The argument changes is invalid: expected changes exactly for a pull request." });
    assert.throws(() => new HostItem(reference, ReferenceKind.Issue, ReferenceState.Open, "Found a bug",
      "https://github.com/octocat/hello-world/issues/2", null, 1, null, 0, changes), { name: "HostingArgumentException", parameterName: "changes" });
    assert.throws(() => HostItem.fromJson({ ...pullRequest.toJson(), changes: null }), { name: "HostingFieldException", field: "$.changes" });
  });

  it("takes a closing time exactly when the item is merged or closed, above zero, naming the closing time", () => {
    const make = (state: ReferenceState, closedAt: number | null): HostItem => new HostItem(reference, ReferenceKind.PullRequest, state,
      "Update the readme", "https://github.com/octocat/hello-world/pull/1", null, 1, closedAt, 0, changes);

    assert.deepEqual([make(ReferenceState.Merged, 3).closedAt, make(ReferenceState.Closed, 1).closedAt, make(ReferenceState.Draft, null).closedAt],
      [3, 1, null]);
    assert.throws(() => make(ReferenceState.Open, 3), HostingArgumentException);
    assert.throws(() => make(ReferenceState.Open, 3),
      { name: "HostingArgumentException", parameterName: "closedAt", message: "The argument closedAt is invalid: expected a time exactly when the item is merged or closed." });
    assert.throws(() => make(ReferenceState.Draft, 3), { name: "HostingArgumentException", parameterName: "closedAt" });
    assert.throws(() => make(ReferenceState.Merged, null), { name: "HostingArgumentException", parameterName: "closedAt" });
    assert.throws(() => make(ReferenceState.Closed, null), { name: "HostingArgumentException", parameterName: "closedAt" });
    assert.throws(() => make(ReferenceState.Merged, 0),
      { name: "HostingArgumentException", parameterName: "closedAt", message: "The argument closedAt is invalid: expected a whole number above zero." });
    assert.throws(() => make(ReferenceState.Merged, 1.5), { name: "HostingArgumentException", parameterName: "closedAt" });
    assert.throws(() => HostItem.fromJson({ ...issue.toJson(), closedAt: null }), { name: "HostingFieldException", field: "$.closedAt" });
    assert.throws(() => HostItem.fromJson({ ...pullRequest.toJson(), closedAt: 5 }), { name: "HostingFieldException", field: "$.closedAt" });
    assert.throws(() => HostItem.fromJson({ ...issue.toJson(), closedAt: -5 }), { name: "HostingFieldException", field: "$.closedAt" });
    assert.throws(() => HostItem.fromJson({ ...issue.toJson(), closedAt: "yesterday" }), { name: "JsonException", path: "$.closedAt" });
  });

  it("refuses a blank title, an address that isn't https, a time that isn't above zero and a comment count below zero, naming the parameter", () => {
    const make = (title: string, url: string, createdAt: number, comments: number): HostItem =>
      new HostItem(reference, ReferenceKind.Issue, ReferenceState.Open, title, url, null, createdAt, null, comments, null);

    assert.throws(() => make(" ", "https://github.com/octocat/hello-world/issues/2", 1, 0), { name: "HostingArgumentException", parameterName: "title" });
    assert.throws(() => make("Found a bug", "http://github.com/octocat/hello-world/issues/2", 1, 0), { name: "HostingArgumentException", parameterName: "url" });
    assert.throws(() => make("Found a bug", "https://octocat@github.com/octocat/hello-world/issues/2", 1, 0), { name: "HostingArgumentException", parameterName: "url" });
    assert.throws(() => make("Found a bug", "https://github.com/octocat/hello-world/issues/2", 0, 0), { name: "HostingArgumentException", parameterName: "createdAt" });
    assert.throws(() => make("Found a bug", "https://github.com/octocat/hello-world/issues/2", 1, -1),
      { name: "HostingArgumentException", parameterName: "comments", message: "The argument comments is invalid: expected a whole number, zero or more." });
    assert.throws(() => make("Found a bug", "https://github.com/octocat/hello-world/issues/2", 1, 0.5), { name: "HostingArgumentException", parameterName: "comments" });
    assert.deepEqual(make("Found a bug", "https://github.com/octocat/hello-world/issues/2", 1, 0).comments, 0);
  });

  it("refuses JSON with a field it doesn't define or out of its range, naming the field by its path", () => {
    const json = pullRequest.toJson();

    assert.throws(() => HostItem.fromJson({ ...json, labels: [] }), HostingFieldException);
    assert.throws(() => HostItem.fromJson({ ...json, labels: [] }),
      { name: "HostingFieldException", field: "$.labels", message: "The field $.labels is invalid: expected none, since the model doesn't define it." });
    assert.throws(() => HostItem.fromJson({ ...json, title: "" }, "$.pullRequest"), { name: "HostingFieldException", field: "$.pullRequest.title" });
    assert.throws(() => HostItem.fromJson({ ...json, url: "ftp://github.com/octocat/hello-world/pull/1" }), { name: "HostingFieldException", field: "$.url" });
    assert.throws(() => HostItem.fromJson({ ...json, createdAt: -5 }), { name: "HostingFieldException", field: "$.createdAt" });
    assert.throws(() => HostItem.fromJson({ ...json, comments: -1 }), { name: "HostingFieldException", field: "$.comments" });
  });

  it("names the path of a bad field in its reference, author or changes", () => {
    const json = pullRequest.toJson();

    assert.throws(() => HostItem.fromJson({ ...json, reference: { ...reference.toJson(), number: 0 } }), { name: "HostingFieldException", field: "$.reference.number" });
    assert.throws(() => HostItem.fromJson({ ...json, author: { login: "", avatar: null, url: null } }, "$.pullRequest"), { name: "HostingFieldException", field: "$.pullRequest.author.login" });
    assert.throws(() => HostItem.fromJson({ ...json, author: { ...author.toJson(), name: "The Octocat" } }), { name: "HostingFieldException", field: "$.author.name" });
    assert.throws(() => HostItem.fromJson({ ...json, changes: { ...changes.toJson(), headCommit: "abc" } }), { name: "HostingFieldException", field: "$.changes.headCommit" });
  });

  it("refuses JSON whose kind or state isn't one it knows, or whose field is missing", () => {
    const json = pullRequest.toJson();

    assert.throws(() => HostItem.fromJson({ ...json, kind: "Discussion" }), { name: "JsonException", path: "$.kind" });
    assert.throws(() => HostItem.fromJson({ ...json, state: "Locked" }), { name: "JsonException", path: "$.state" });
    assert.throws(() => HostItem.fromJson({ ...json, reference: null }), { name: "JsonException", path: "$.reference" });
    assert.throws(() => HostItem.fromJson({ ...json, author: "octocat" }), { name: "JsonException", path: "$.author" });
  });
});
