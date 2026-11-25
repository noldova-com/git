/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";

import { describe, it } from "vitest";

import { GitRebaseCommit } from "../../src/models/git-rebase-commit.ts";
import { GitRebasePlan } from "../../src/models/git-rebase-plan.ts";
import type { IFieldFailure } from "../fixtures/field-failure.fixture.ts";

const expected = (field: string, expectation: string): IFieldFailure =>
  ({ name: "ProtocolFieldException", field, message: `The field ${field} is invalid: expected ${expectation}.` });

const a = "a".repeat(40);
const b = "b".repeat(40);
const c = "c".repeat(40);
const d = "d".repeat(40);

describe("GitRebasePlan", () => {
  const commit = new GitRebaseCommit(a, "Start", null);
  const fixup = new GitRebaseCommit(b, "fixup! Start", a);
  const json = { branch: "main", onto: c, base: d, ontoAhead: 0, commits: [], stacked: [], pushed: false };

  it("keeps its branch, target, base, how far the target is ahead, copies of its commits and stacked branches, and whether it is pushed", () => {
    const commits: GitRebaseCommit[] = [commit, fixup];
    const stacked: string[] = ["feature/a"];
    const plan = new GitRebasePlan("main", c, d, 3, commits, stacked, true);
    commits.pop();
    stacked.push("other");

    assert.deepEqual(plan.toJson(), {
      branch: "main",
      onto: c,
      base: d,
      ontoAhead: 3,
      commits: [{ id: a, message: "Start", fixupOf: null }, { id: b, message: "fixup! Start", fixupOf: a }],
      stacked: ["feature/a"],
      pushed: true
    });
    assert.deepEqual(GitRebasePlan.fromJson(JSON.parse(JSON.stringify(plan.toJson()))), plan);
  });

  it("reads back a detached HEAD with no commits the same", () => {
    const detached = new GitRebasePlan(null, c, d, 0, [], [], false);

    assert.equal(detached.toJson()["branch"], null);
    assert.deepEqual(GitRebasePlan.fromJson(JSON.parse(JSON.stringify(detached.toJson()))), detached);
  });

  it("refuses a branch or stacked branch git wouldn't take, a target or base that isn't a full id, and a negative count, naming its path", () => {
    const branch = "a branch name git accepts: 1 to 255 characters, not - first, not @ or HEAD alone, not . last, without .., @{, a space, a control character "
      + "or any of ~^:?*[\\, and with no segment between slashes that is empty, starts with . or ends with .lock";
    const objectId = "a full hexadecimal object id";

    assert.throws(() => GitRebasePlan.fromJson({ ...json, branch: "-x" }), expected("$.branch", branch));
    assert.throws(() => new GitRebasePlan("", c, d, 0, [], [], false), expected("branch", branch));
    assert.throws(() => GitRebasePlan.fromJson({ ...json, stacked: ["ok", "a..b"] }), expected("$.stacked.1", branch));
    assert.throws(() => GitRebasePlan.fromJson({ ...json, onto: "main" }), expected("$.onto", objectId));
    assert.throws(() => GitRebasePlan.fromJson({ ...json, base: "" }), expected("$.base", objectId));
    assert.throws(() => GitRebasePlan.fromJson({ ...json, ontoAhead: -1 }), expected("$.ontoAhead", "a whole number of zero or more"));
    assert.throws(() => new GitRebasePlan("main", c, d, 0.5, [], [], false), expected("ontoAhead", "a whole number of zero or more"));
  });

  it("takes up to 500 commits and refuses more, and refuses a broken commit at its path", () => {
    const commits = "between 1 and 500 steps, each commit once, with no Squash or Fixup before the first step it can fold into";

    assert.equal(new GitRebasePlan("main", c, d, 0, Array.from({ length: 500 }, () => commit), [], false).commits.length, 500);
    assert.throws(() => new GitRebasePlan("main", c, d, 0, Array.from({ length: 501 }, () => commit), [], false), expected("commits", commits));
    assert.throws(() => GitRebasePlan.fromJson({ ...json, commits: [{ id: "x", message: "m", fixupOf: null }] }), expected("$.commits.0.id", "a full hexadecimal object id"));
  });

  it("refuses a missing branch, a pushed flag that isn't a boolean and a field it doesn't define", () => {
    const { branch: _branch, ...missing } = json;

    assert.throws(() => GitRebasePlan.fromJson(missing), { name: "JsonException", path: "$.branch" });
    assert.throws(() => GitRebasePlan.fromJson({ ...json, pushed: 1 }), { name: "JsonException", path: "$.pushed" });
    assert.throws(() => GitRebasePlan.fromJson({ ...json, more: 1 }), expected("$.more", "none, since the model doesn't define it"));
  });
});
