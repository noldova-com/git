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
import { GitRebaseStepCheck } from "../../src/models/git-rebase-step-check.ts";
import type { IFieldFailure } from "../fixtures/field-failure.fixture.ts";

const expected = (field: string, expectation: string): IFieldFailure =>
  ({ name: "ProtocolFieldException", field, message: `The field ${field} is invalid: expected ${expectation}.` });

describe("GitRebaseStepCheck", () => {
  it("keeps its outcome and a copy of its conflicting paths, and reads back the same for each outcome", () => {
    const paths: string[] = ["src/a.ts", "b c.md"];
    const conflicts = new GitRebaseStepCheck(RebaseCheckOutcome.Conflicts, paths);
    paths.push("d.ts");

    assert.deepEqual(conflicts.toJson(), { outcome: "Conflicts", paths: ["src/a.ts", "b c.md"] });
    assert.deepEqual(GitRebaseStepCheck.fromJson(JSON.parse(JSON.stringify(conflicts.toJson()))), conflicts);
    for (const outcome of [RebaseCheckOutcome.Clean, RebaseCheckOutcome.Folded, RebaseCheckOutcome.Dropped, RebaseCheckOutcome.Unavailable]) {
      const each = new GitRebaseStepCheck(outcome, []);
      assert.deepEqual(GitRebaseStepCheck.fromJson(JSON.parse(JSON.stringify(each.toJson()))), each);
    }
  });

  it("has paths exactly when it conflicts, each a relative path, naming its path", () => {
    const paths = "at least one path exactly when the outcome is Conflicts";
    const relative = "a relative path of 1 to 4096 characters, not starting with a drive and colon, a colon or a backslash, without a .. segment or a NUL character";

    assert.throws(() => GitRebaseStepCheck.fromJson({ outcome: "Conflicts", paths: [] }), expected("$.paths", paths));
    assert.throws(() => new GitRebaseStepCheck(RebaseCheckOutcome.Clean, ["a.ts"]), expected("paths", paths));
    assert.throws(() => GitRebaseStepCheck.fromJson({ outcome: "Conflicts", paths: ["a.ts", "../b.ts"] }), expected("$.paths.1", relative));
    assert.throws(() => new GitRebaseStepCheck(RebaseCheckOutcome.Conflicts, ["/etc/passwd"]), expected("paths.0", relative));
  });

  it("refuses an unknown outcome, missing paths and a field it doesn't define", () => {
    assert.throws(() => GitRebaseStepCheck.fromJson({ outcome: "Merged", paths: [] }), { name: "JsonException", path: "$.outcome" });
    assert.throws(() => GitRebaseStepCheck.fromJson({ outcome: "Clean" }), { name: "JsonException", path: "$.paths" });
    assert.throws(() => GitRebaseStepCheck.fromJson({ outcome: "Clean", paths: [], more: 1 }), expected("$.more", "none, since the model doesn't define it"));
  });
});
