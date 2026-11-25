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
import { GitRebaseParams } from "../../src/models/git-rebase-params.ts";
import { RebaseStep } from "../../src/models/rebase-step.ts";
import type { IFieldFailure } from "../fixtures/field-failure.fixture.ts";

const expected = (field: string, expectation: string): IFieldFailure =>
  ({ name: "ProtocolFieldException", field, message: `The field ${field} is invalid: expected ${expectation}.` });

const a = "a".repeat(40);
const b = "b".repeat(40);
const c = "c".repeat(40);

describe("GitRebaseParams", () => {
  const pick = new RebaseStep(a, RebaseAction.Pick, null);
  const reword = new RebaseStep(b, RebaseAction.Reword, "Better");
  const json = { folder: "/r", onto: c, steps: [pick.toJson()], updateRefs: false, basedOn: "p" };

  it("keeps its folder, target, a copy of its steps, whether other branches move and the fingerprint, and reads back the same", () => {
    const steps: RebaseStep[] = [pick, reword];
    const params = new GitRebaseParams("/home/a/repo", c, steps, true, "print");
    steps.length = 0;

    assert.deepEqual(params.toJson(), {
      folder: "/home/a/repo",
      onto: c,
      steps: [{ id: a, action: "Pick", message: null }, { id: b, action: "Reword", message: "Better" }],
      updateRefs: true,
      basedOn: "print"
    });
    assert.deepEqual(GitRebaseParams.fromJson(JSON.parse(JSON.stringify(params.toJson()))), params);
    assert.deepEqual(GitRebaseParams.fromJson(json), new GitRebaseParams("/r", c, [pick], false, "p"));
  });

  it("refuses a relative folder, a target that isn't a full id, steps that can't run and an empty fingerprint, naming its path", () => {
    const steps = "between 1 and 500 steps, each commit once, with no Squash or Fixup before the first step it can fold into";

    assert.throws(() => GitRebaseParams.fromJson({ ...json, folder: "repo" }), expected("$.folder", "an absolute path of at most 4096 characters"));
    assert.throws(() => GitRebaseParams.fromJson({ ...json, onto: "HEAD" }), expected("$.onto", "a full hexadecimal object id"));
    assert.throws(() => GitRebaseParams.fromJson({ ...json, steps: [] }), expected("$.steps", steps));
    assert.throws(() => new GitRebaseParams("/r", c, [new RebaseStep(a, RebaseAction.Fixup, null)], false, "p"), expected("steps", steps));
    assert.throws(() => GitRebaseParams.fromJson({ ...json, basedOn: "" }), expected("$.basedOn", "a text that isn't empty"));
    assert.throws(() => GitRebaseParams.fromJson({ ...json, steps: [{ id: a, action: "Pick", message: "x" }] }),
      expected("$.steps.0.message", "a message exactly when the action is Reword or Squash"));
  });

  it("refuses a flag that isn't a boolean and a field it doesn't define", () => {
    assert.throws(() => GitRebaseParams.fromJson({ ...json, updateRefs: "true" }), { name: "JsonException", path: "$.updateRefs" });
    assert.throws(() => GitRebaseParams.fromJson({ ...json, more: 1 }), expected("$.more", "none, since the model doesn't define it"));
  });
});
