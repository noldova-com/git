/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";

import { describe, it } from "vitest";

import { RebaseCheckOutcome } from "../../src/enums/rebase-check-outcome.ts";
import { GitRebaseCheck } from "../../src/models/git-rebase-check.ts";
import { GitRebaseStepCheck } from "../../src/models/git-rebase-step-check.ts";

const expected = (field: string, expectation: string): { name: string; field: string; message: string } =>
  ({ name: "ProtocolFieldException", field, message: `The field ${field} is invalid: expected ${expectation}.` });

describe("GitRebaseCheck", () => {
  const clean = new GitRebaseStepCheck(RebaseCheckOutcome.Clean, []);
  const conflicts = new GitRebaseStepCheck(RebaseCheckOutcome.Conflicts, ["src/a.ts"]);

  it("keeps a copy of one check per step in order, and reads back the same, with no steps too", () => {
    const steps: GitRebaseStepCheck[] = [clean, conflicts];
    const check = new GitRebaseCheck(steps);
    steps.reverse();

    assert.deepEqual(check.toJson(), { steps: [{ outcome: "Clean", paths: [] }, { outcome: "Conflicts", paths: ["src/a.ts"] }] });
    assert.deepEqual(GitRebaseCheck.fromJson(JSON.parse(JSON.stringify(check.toJson()))), check);
    assert.deepEqual(GitRebaseCheck.fromJson({ steps: [] }), new GitRebaseCheck([]));
  });

  it("takes up to 500 checks and refuses more", () => {
    const steps = "between 1 and 500 steps, each commit once, with no Squash or Fixup before the first step it can fold into";

    assert.equal(new GitRebaseCheck(Array.from({ length: 500 }, () => clean)).steps.length, 500);
    assert.throws(() => new GitRebaseCheck(Array.from({ length: 501 }, () => clean)), expected("steps", steps));
    assert.throws(() => GitRebaseCheck.fromJson({ steps: Array.from({ length: 501 }, () => clean.toJson()) }), expected("$.steps", steps));
  });

  it("refuses a broken check at its path, missing steps and a field it doesn't define", () => {
    assert.throws(() => GitRebaseCheck.fromJson({ steps: [clean.toJson(), { outcome: "Conflicts", paths: [] }] }),
      expected("$.steps.1.paths", "at least one path exactly when the outcome is Conflicts"));
    assert.throws(() => GitRebaseCheck.fromJson({}), { name: "JsonException", path: "$.steps" });
    assert.throws(() => GitRebaseCheck.fromJson({ steps: [], more: 1 }), expected("$.more", "none, since the model doesn't define it"));
  });
});
