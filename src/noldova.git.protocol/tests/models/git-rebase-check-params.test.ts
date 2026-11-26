/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";

import { describe, it } from "vitest";

import { RebaseAction } from "../../src/enums/rebase-action.ts";
import { GitRebaseCheckParams } from "../../src/models/git-rebase-check-params.ts";
import { RebaseStep } from "../../src/models/rebase-step.ts";
import type { IFieldFailure } from "../fixtures/field-failure.fixture.ts";

const expected = (field: string, expectation: string): IFieldFailure =>
  ({ name: "ProtocolFieldException", field, message: `The field ${field} is invalid: expected ${expectation}.` });

const a = "a".repeat(40);
const b = "b".repeat(40);
const c = "c".repeat(40);

describe("GitRebaseCheckParams", () => {
  const pick = new RebaseStep(a, RebaseAction.Pick, null);
  const squash = new RebaseStep(b, RebaseAction.Squash, "Both");

  it("keeps its folder, target and a copy of its steps, and reads back the same", () => {
    const steps: RebaseStep[] = [pick, squash];
    const params = new GitRebaseCheckParams("/home/a/repo", c, steps);
    steps.pop();

    assert.deepEqual(params.toJson(), { folder: "/home/a/repo", onto: c, steps: [{ id: a, action: "Pick", message: null }, { id: b, action: "Squash", message: "Both" }] });
    assert.deepEqual(GitRebaseCheckParams.fromJson(JSON.parse(JSON.stringify(params.toJson()))), params);
  });

  it("refuses a relative folder, a target that isn't a full id, and steps that can't run, naming their path", () => {
    const steps = "between 1 and 500 steps, each commit once, with no Squash or Fixup before the first step it can fold into";

    assert.throws(() => GitRebaseCheckParams.fromJson({ folder: "repo", onto: c, steps: [pick.toJson()] }), expected("$.folder", "an absolute path of at most 4096 characters"));
    assert.throws(() => GitRebaseCheckParams.fromJson({ folder: "/r", onto: "main", steps: [pick.toJson()] }), expected("$.onto", "a full hexadecimal object id"));
    assert.throws(() => GitRebaseCheckParams.fromJson({ folder: "/r", onto: c, steps: [] }), expected("$.steps", steps));
    assert.throws(() => GitRebaseCheckParams.fromJson({ folder: "/r", onto: c, steps: [pick.toJson(), pick.toJson()] }), expected("$.steps", steps));
    assert.throws(() => new GitRebaseCheckParams("/r", c, [squash, pick]), expected("steps", steps));
  });

  it("refuses a broken step at its path and a field it doesn't define", () => {
    assert.throws(() => GitRebaseCheckParams.fromJson({ folder: "/r", onto: c, steps: [{ id: "x", action: "Pick", message: null }] }),
      expected("$.steps.0.id", "a full hexadecimal object id"));
    assert.throws(() => GitRebaseCheckParams.fromJson({ folder: "/r", onto: c, steps: [1] }), { name: "JsonException", path: "$.steps.0" });
    assert.throws(() => GitRebaseCheckParams.fromJson({ folder: "/r", onto: c, steps: [pick.toJson()], more: 1 }),
      expected("$.more", "none, since the model doesn't define it"));
  });
});
