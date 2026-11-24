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
import { RebaseStep } from "../../src/models/rebase-step.ts";

const expected = (field: string, expectation: string): { name: string; field: string; message: string } =>
  ({ name: "ProtocolFieldException", field, message: `The field ${field} is invalid: expected ${expectation}.` });

const a = "a".repeat(40);
const b = "b".repeat(40);
const c = "c".repeat(40);

describe("RebaseStep", () => {
  it("keeps its commit, action and message, and reads back the same for each action", () => {
    const pick = new RebaseStep(a, RebaseAction.Pick, null);
    const reword = new RebaseStep(b, RebaseAction.Reword, "New subject\n\nBody");
    const steps = [
      pick,
      reword,
      new RebaseStep(a, RebaseAction.Edit, null),
      new RebaseStep(a, RebaseAction.Squash, "Whole\n"),
      new RebaseStep(a, RebaseAction.Fixup, null),
      new RebaseStep(a, RebaseAction.Drop, null)
    ];

    assert.deepEqual(reword.toJson(), { id: b, action: "Reword", message: "New subject\n\nBody" });
    assert.deepEqual(pick.toJson(), { id: a, action: "Pick", message: null });
    for (const step of steps)
      assert.deepEqual(RebaseStep.fromJson(JSON.parse(JSON.stringify(step.toJson()))), step);
  });

  it("carries a message exactly for a Reword or a Squash, with text that isn't blank and has no NUL, naming its path", () => {
    const message = "a message exactly when the action is Reword or Squash";

    assert.throws(() => RebaseStep.fromJson({ id: a, action: "Pick", message: "x" }), expected("$.message", message));
    assert.throws(() => new RebaseStep(a, RebaseAction.Fixup, "x"), expected("message", message));
    assert.throws(() => RebaseStep.fromJson({ id: a, action: "Squash", message: null }), expected("$.message", message));
    assert.throws(() => new RebaseStep(a, RebaseAction.Reword, null), expected("message", message));
    assert.throws(() => RebaseStep.fromJson({ id: a, action: "Reword", message: " \n\t" }), expected("$.message", "a text that isn't empty"));
    assert.throws(() => RebaseStep.fromJson({ id: a, action: "Reword", message: "a\u0000b" }), expected("$.message", "a text without a NUL character"));
  });

  it("refuses an id that isn't a full object id, an unknown action, a missing message and a field it doesn't define", () => {
    assert.throws(() => RebaseStep.fromJson({ id: "main", action: "Pick", message: null }), expected("$.id", "a full hexadecimal object id"));
    assert.throws(() => RebaseStep.fromJson({ id: a, action: "Rebase", message: null }), { name: "JsonException", path: "$.action" });
    assert.throws(() => RebaseStep.fromJson({ id: a, action: "Pick" }), { name: "JsonException", path: "$.message" });
    assert.throws(() => RebaseStep.fromJson({ id: a, action: "Pick", message: null, more: 1 }), expected("$.more", "none, since the model doesn't define it"));
  });

  it("takes 1 to 500 steps with each commit once and something to fold into, and refuses none, too many, a repeat or a fold first", () => {
    const steps = "between 1 and 500 steps, each commit once, with no Squash or Fixup before the first step it can fold into";
    const pick = new RebaseStep(a, RebaseAction.Pick, null);
    const fixup = new RebaseStep(b, RebaseAction.Fixup, null);
    const drop = new RebaseStep(c, RebaseAction.Drop, null);
    const many = Array.from({ length: 501 }, (_, i) => new RebaseStep(i.toString(16).padStart(40, "0"), RebaseAction.Pick, null));

    assert.doesNotThrow(() => RebaseStep.requireSteps([pick, fixup]));
    assert.doesNotThrow(() => RebaseStep.requireSteps([drop, pick, fixup]));
    assert.doesNotThrow(() => RebaseStep.requireSteps([drop]));
    assert.doesNotThrow(() => RebaseStep.requireSteps(many.slice(0, 500)));
    for (const each of [[], many, [pick, pick], [fixup, pick], [drop, new RebaseStep(a, RebaseAction.Squash, "s"), fixup]])
      assert.throws(() => RebaseStep.requireSteps(each), expected("steps", steps));
  });
});
