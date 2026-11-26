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
import { RebaseCheckOutcome } from "../../src/enums/rebase-check-outcome.ts";
import { GitRebaseCheck } from "../../src/models/git-rebase-check.ts";
import { GitRebaseCheckParams } from "../../src/models/git-rebase-check-params.ts";
import { GitRebaseCommit } from "../../src/models/git-rebase-commit.ts";
import { GitRebaseParams } from "../../src/models/git-rebase-params.ts";
import { GitRebasePlan } from "../../src/models/git-rebase-plan.ts";
import { GitRebasePlanParams } from "../../src/models/git-rebase-plan-params.ts";
import { GitRebaseStepCheck } from "../../src/models/git-rebase-step-check.ts";
import { RebaseStep } from "../../src/models/rebase-step.ts";

const folder = "/home/a/repo";
const a = "a".repeat(40);
const b = "b".repeat(40);
const c = "c".repeat(40);

describe("RebaseStep", () => {
  it("keeps a message only for a Reword or a Squash, reads back the same, and refuses each field broken", () => {
    const pick = new RebaseStep(a, RebaseAction.Pick, null);
    const reword = new RebaseStep(b, RebaseAction.Reword, "New subject\n\nBody");

    assert.deepEqual(reword.toJson(), { id: b, action: "Reword", message: "New subject\n\nBody" });
    assert.deepEqual([RebaseStep.fromJson(pick.toJson()), RebaseStep.fromJson(reword.toJson())], [pick, reword]);
    assert.throws(() => RebaseStep.fromJson({ id: "main", action: "Pick", message: null }), { name: "ProtocolFieldException", field: "$.id" });
    assert.throws(() => RebaseStep.fromJson({ id: a, action: "Rebase", message: null }), { name: "JsonException", path: "$.action" });
    assert.throws(() => RebaseStep.fromJson({ id: a, action: "Pick", message: "x" }), { name: "ProtocolFieldException", field: "$.message" });
    assert.throws(() => RebaseStep.fromJson({ id: a, action: "Squash", message: null }), { name: "ProtocolFieldException", field: "$.message" });
    assert.throws(() => RebaseStep.fromJson({ id: a, action: "Reword", message: " \n" }), { name: "ProtocolFieldException", field: "$.message" });
    assert.throws(() => RebaseStep.fromJson({ id: a, action: "Reword", message: "a\u0000b" }), { name: "ProtocolFieldException", field: "$.message" });
    assert.throws(() => RebaseStep.fromJson({ id: a, action: "Pick", message: null, more: 1 }), { name: "ProtocolFieldException" });
  });

  it("takes steps with each commit once and something to fold into, and refuses none, too many, a repeat, or a fold first", () => {
    const pick = new RebaseStep(a, RebaseAction.Pick, null);
    const fixup = new RebaseStep(b, RebaseAction.Fixup, null);
    const drop = new RebaseStep(c, RebaseAction.Drop, null);
    const many = Array.from({ length: 501 }, (_, i) => new RebaseStep(i.toString(16).padStart(40, "0"), RebaseAction.Pick, null));

    assert.doesNotThrow(() => RebaseStep.requireSteps([pick, fixup]));
    assert.doesNotThrow(() => RebaseStep.requireSteps([drop]));
    assert.doesNotThrow(() => RebaseStep.requireSteps(many.slice(0, 500)));
    for (const steps of [[], many, [pick, pick], [fixup, pick], [drop, new RebaseStep(a, RebaseAction.Squash, "s"), pick]])
      assert.throws(() => RebaseStep.requireSteps(steps), { name: "ProtocolFieldException", field: "steps" });
  });
});

describe("GitRebasePlanParams", () => {
  it("keeps its folder and target, reads back the same, and refuses each field broken and an unknown field", () => {
    const params = new GitRebasePlanParams(folder, a);

    assert.deepEqual(params.toJson(), { folder, onto: a });
    assert.deepEqual(GitRebasePlanParams.fromJson(params.toJson()), params);
    assert.throws(() => GitRebasePlanParams.fromJson({ folder: "repo", onto: a }), { name: "ProtocolFieldException", field: "$.folder" });
    assert.throws(() => GitRebasePlanParams.fromJson({ folder, onto: "main" }), { name: "ProtocolFieldException", field: "$.onto" });
    assert.throws(() => GitRebasePlanParams.fromJson({ folder, onto: a, more: 1 }), { name: "ProtocolFieldException" });
  });
});

describe("GitRebaseCommit", () => {
  it("keeps its id, message and fold target, gives the subject, reads back the same, and refuses each field broken", () => {
    const fixup = new GitRebaseCommit(b, "fixup! Draw lanes\n\nBody", a);
    const plain = new GitRebaseCommit(a, "Draw lanes", null);

    assert.deepEqual([fixup.subject, plain.subject], ["fixup! Draw lanes", "Draw lanes"]);
    assert.deepEqual(fixup.toJson(), { id: b, message: "fixup! Draw lanes\n\nBody", fixupOf: a });
    assert.deepEqual([GitRebaseCommit.fromJson(fixup.toJson()), GitRebaseCommit.fromJson(plain.toJson())], [fixup, plain]);
    assert.throws(() => GitRebaseCommit.fromJson({ id: "x", message: "m", fixupOf: null }), { name: "ProtocolFieldException", field: "$.id" });
    assert.throws(() => GitRebaseCommit.fromJson({ id: a, message: "m\u0000", fixupOf: null }), { name: "ProtocolFieldException", field: "$.message" });
    assert.throws(() => GitRebaseCommit.fromJson({ id: a, message: "m", fixupOf: "x" }), { name: "ProtocolFieldException", field: "$.fixupOf" });
    assert.throws(() => GitRebaseCommit.fromJson({ id: a, message: "m", fixupOf: null, more: 1 }), { name: "ProtocolFieldException" });
  });
});

describe("GitRebasePlan", () => {
  it("keeps the branch, target, base, commits, stacked branches and whether it was pushed, and reads back the same", () => {
    const plan = new GitRebasePlan("feature/graph", c, b, 4, [new GitRebaseCommit(a, "Draw lanes", null)], ["feature/minimap"], true);
    const detached = new GitRebasePlan(null, c, b, 0, [], [], false);

    assert.deepEqual(plan.toJson(), {
      branch: "feature/graph", onto: c, base: b, ontoAhead: 4, commits: [{ id: a, message: "Draw lanes", fixupOf: null }], stacked: ["feature/minimap"], pushed: true
    });
    assert.deepEqual([GitRebasePlan.fromJson(plan.toJson()), GitRebasePlan.fromJson(detached.toJson())], [plan, detached]);
  });

  it("refuses a bad branch, target, base, count, too many commits, a bad stacked name and an unknown field", () => {
    const good = new GitRebasePlan("main", c, b, 0, [], [], false).toJson();
    const commits = Array.from({ length: 501 }, (_, i) => new GitRebaseCommit(i.toString(16).padStart(40, "0"), "m", null).toJson());

    assert.throws(() => GitRebasePlan.fromJson({ ...good, branch: "-x" }), { name: "ProtocolFieldException", field: "$.branch" });
    assert.throws(() => GitRebasePlan.fromJson({ ...good, onto: "x" }), { name: "ProtocolFieldException", field: "$.onto" });
    assert.throws(() => GitRebasePlan.fromJson({ ...good, base: "x" }), { name: "ProtocolFieldException", field: "$.base" });
    assert.throws(() => GitRebasePlan.fromJson({ ...good, ontoAhead: -1 }), { name: "ProtocolFieldException", field: "$.ontoAhead" });
    assert.throws(() => GitRebasePlan.fromJson({ ...good, commits }), { name: "ProtocolFieldException", field: "$.commits" });
    assert.throws(() => GitRebasePlan.fromJson({ ...good, stacked: ["ok", ""] }), { name: "ProtocolFieldException", field: "$.stacked.1" });
    assert.throws(() => GitRebasePlan.fromJson({ ...good, more: 1 }), { name: "ProtocolFieldException" });
  });
});

describe("GitRebaseCheckParams and GitRebaseParams", () => {
  const steps = [new RebaseStep(a, RebaseAction.Pick, null), new RebaseStep(b, RebaseAction.Fixup, null)];

  it("keep their folder, target, steps and options, read back the same, and refuse bad steps", () => {
    const check = new GitRebaseCheckParams(folder, c, steps);
    const rebase = new GitRebaseParams(folder, c, steps, true, "f1");
    const json = steps.map(t => t.toJson());

    assert.deepEqual(check.toJson(), { folder, onto: c, steps: json });
    assert.deepEqual(rebase.toJson(), { folder, onto: c, steps: json, updateRefs: true, basedOn: "f1" });
    assert.deepEqual([GitRebaseCheckParams.fromJson(check.toJson()), GitRebaseParams.fromJson(rebase.toJson())], [check, rebase]);
    assert.throws(() => GitRebaseCheckParams.fromJson({ folder, onto: c, steps: [] }), { name: "ProtocolFieldException", field: "$.steps" });
    assert.throws(() => GitRebaseParams.fromJson({ ...rebase.toJson(), steps: [json[1], json[0]] }), { name: "ProtocolFieldException", field: "$.steps" });
  });

  it("refuse a bad folder, target, fingerprint and an unknown field", () => {
    const check = new GitRebaseCheckParams(folder, c, steps).toJson();
    const rebase = new GitRebaseParams(folder, c, steps, false, "f1").toJson();

    assert.throws(() => GitRebaseCheckParams.fromJson({ ...check, folder: "repo" }), { name: "ProtocolFieldException", field: "$.folder" });
    assert.throws(() => GitRebaseCheckParams.fromJson({ ...check, onto: "main" }), { name: "ProtocolFieldException", field: "$.onto" });
    assert.throws(() => GitRebaseCheckParams.fromJson({ ...check, more: 1 }), { name: "ProtocolFieldException" });
    assert.throws(() => GitRebaseParams.fromJson({ ...rebase, folder: "repo" }), { name: "ProtocolFieldException", field: "$.folder" });
    assert.throws(() => GitRebaseParams.fromJson({ ...rebase, onto: "main" }), { name: "ProtocolFieldException", field: "$.onto" });
    assert.throws(() => GitRebaseParams.fromJson({ ...rebase, basedOn: "" }), { name: "ProtocolFieldException", field: "$.basedOn" });
    assert.throws(() => GitRebaseParams.fromJson({ ...rebase, more: 1 }), { name: "ProtocolFieldException" });
  });
});

describe("GitRebaseStepCheck and GitRebaseCheck", () => {
  it("keep each step's outcome and paths, read back the same, and refuse a bad outcome, paths and too many steps", () => {
    const check = new GitRebaseCheck([new GitRebaseStepCheck(RebaseCheckOutcome.Conflicts, ["src/a.ts"]), new GitRebaseStepCheck(RebaseCheckOutcome.Folded, [])]);
    const many = Array.from({ length: 501 }, () => new GitRebaseStepCheck(RebaseCheckOutcome.Clean, []).toJson());

    assert.deepEqual(check.toJson(), { steps: [{ outcome: "Conflicts", paths: ["src/a.ts"] }, { outcome: "Folded", paths: [] }] });
    assert.deepEqual(GitRebaseCheck.fromJson(check.toJson()), check);
    assert.throws(() => GitRebaseStepCheck.fromJson({ outcome: "Maybe", paths: [] }), { name: "JsonException", path: "$.outcome" });
    assert.throws(() => GitRebaseStepCheck.fromJson({ outcome: "Clean", paths: ["a"] }), { name: "ProtocolFieldException", field: "$.paths" });
    assert.throws(() => GitRebaseStepCheck.fromJson({ outcome: "Conflicts", paths: ["../a"] }), { name: "ProtocolFieldException", field: "$.paths.0" });
    assert.throws(() => GitRebaseStepCheck.fromJson({ outcome: "Clean", paths: [], more: 1 }), { name: "ProtocolFieldException" });
    assert.throws(() => GitRebaseCheck.fromJson({ steps: many }), { name: "ProtocolFieldException", field: "$.steps" });
    assert.throws(() => GitRebaseCheck.fromJson({ steps: [], more: 1 }), { name: "ProtocolFieldException" });
  });
});
