/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */


import assert from "node:assert/strict";

import { describe, it } from "vitest";

import { HostChanges, HostingArgumentException, HostingFieldException } from "../../src/api/index.ts";

const commit: string = "6dcb09b5b57875f334f61aebed695e2e4193db5e";
const longCommit: string = "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855";
const changes: HostChanges = new HostChanges(12, 3, 2, "feature/readme", "main", commit);

describe("HostChanges", () => {
  it("takes no changed lines and a 64-digit commit, and returns itself as JSON that reads back the same", () => {
    const empty: HostChanges = new HostChanges(0, 0, 0, "feature/readme", "main", longCommit);

    assert.deepEqual(HostChanges.fromJson(empty.toJson()), empty);
    assert.deepEqual(HostChanges.fromJson(changes.toJson()), changes);
    assert.deepEqual([empty.additions, empty.deletions, empty.changedFiles, empty.headCommit], [0, 0, 0, longCommit]);
  });

  it("marks changes a host doesn't count, with zero counts, writes that only for them, and returns them as JSON that reads back the same", () => {
    const uncounted: HostChanges = HostChanges.uncounted("feature/readme", "main", commit);

    assert.deepEqual([uncounted.isCounted, changes.isCounted, uncounted.additions, uncounted.deletions, uncounted.changedFiles], [false, true, 0, 0, 0]);
    assert.deepEqual(uncounted.toJson(),
      { additions: 0, deletions: 0, changedFiles: 0, headBranch: "feature/readme", baseBranch: "main", headCommit: commit, isCounted: false });
    assert.deepEqual(changes.toJson(), { additions: 12, deletions: 3, changedFiles: 2, headBranch: "feature/readme", baseBranch: "main", headCommit: commit });
    assert.deepEqual(HostChanges.fromJson(uncounted.toJson()), uncounted);
    assert.deepEqual(HostChanges.fromJson({ ...changes.toJson(), isCounted: true }), changes);
  });

  it("refuses counts above zero for changes the host doesn't count, naming the flag", () => {
    assert.throws(() => new HostChanges(1, 0, 0, "feature/readme", "main", commit, undefined, false),
      { name: "HostingArgumentException", parameterName: "isCounted", message: "The argument isCounted is invalid: expected zero counts when the host doesn't count them." });
    assert.throws(() => new HostChanges(0, 0, 1, "feature/readme", "main", commit, undefined, false), { name: "HostingArgumentException", parameterName: "isCounted" });
    assert.throws(() => HostChanges.fromJson({ ...changes.toJson(), isCounted: false }, "$.changes"), { name: "HostingFieldException", field: "$.changes.isCounted" });
    assert.throws(() => HostChanges.fromJson({ ...changes.toJson(), deletions: null }), { name: "JsonException", path: "$.deletions" });
  });

  it("refuses counts below zero or not whole, naming the parameter", () => {
    assert.throws(() => new HostChanges(-1, 0, 0, "feature/readme", "main", commit), HostingArgumentException);
    assert.throws(() => new HostChanges(-1, 0, 0, "feature/readme", "main", commit),
      { name: "HostingArgumentException", parameterName: "additions", message: "The argument additions is invalid: expected a whole number, zero or more." });
    assert.throws(() => new HostChanges(1.5, 0, 0, "feature/readme", "main", commit), { name: "HostingArgumentException", parameterName: "additions" });
    assert.throws(() => new HostChanges(Number.MAX_SAFE_INTEGER + 1, 0, 0, "feature/readme", "main", commit), { name: "HostingArgumentException", parameterName: "additions" });
    assert.throws(() => new HostChanges(0, -1, 0, "feature/readme", "main", commit), { name: "HostingArgumentException", parameterName: "deletions" });
    assert.throws(() => new HostChanges(0, 0, -1, "feature/readme", "main", commit), { name: "HostingArgumentException", parameterName: "changedFiles" });
  });

  it("refuses blank branches and a commit that isn't 40 or 64 lowercase hexadecimal digits, naming the parameter", () => {
    assert.throws(() => new HostChanges(0, 0, 0, " ", "main", commit), { name: "HostingArgumentException", parameterName: "headBranch" });
    assert.throws(() => new HostChanges(0, 0, 0, "feature/readme", "", commit), { name: "HostingArgumentException", parameterName: "baseBranch" });
    assert.throws(() => new HostChanges(0, 0, 0, "feature/readme", "main", commit.slice(0, 7)),
      { name: "HostingArgumentException", parameterName: "headCommit", message: "The argument headCommit is invalid: expected a full commit hash, 40 or 64 lowercase hexadecimal digits." });
    assert.throws(() => new HostChanges(0, 0, 0, "feature/readme", "main", commit.toUpperCase()), { name: "HostingArgumentException", parameterName: "headCommit" });
    assert.throws(() => new HostChanges(0, 0, 0, "feature/readme", "main", `${commit}0`), { name: "HostingArgumentException", parameterName: "headCommit" });
    assert.throws(() => new HostChanges(0, 0, 0, "feature/readme", "main", `${longCommit}0`), { name: "HostingArgumentException", parameterName: "headCommit" });
    assert.throws(() => new HostChanges(0, 0, 0, "feature/readme", "main", "g".repeat(40)), { name: "HostingArgumentException", parameterName: "headCommit" });
  });

  it("refuses JSON with a field it doesn't define or out of its range, naming the field by its path", () => {
    const json = changes.toJson();

    assert.throws(() => HostChanges.fromJson({ ...json, commits: 1 }), HostingFieldException);
    assert.throws(() => HostChanges.fromJson({ ...json, commits: 1 }), { name: "HostingFieldException", field: "$.commits" });
    assert.throws(() => HostChanges.fromJson({ ...json, additions: -1 }, "$.changes"), { name: "HostingFieldException", field: "$.changes.additions" });
    assert.throws(() => HostChanges.fromJson({ ...json, deletions: Number.MAX_SAFE_INTEGER + 1 }), { name: "JsonException", path: "$.deletions" });
    assert.throws(() => HostChanges.fromJson({ ...json, headCommit: commit.toUpperCase() }), { name: "HostingFieldException", field: "$.headCommit" });
    assert.throws(() => HostChanges.fromJson({ ...json, changedFiles: 1.5 }), { name: "JsonException", path: "$.changedFiles" });
  });
});
