/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";
import { describe, it } from "vitest";

import { PredictionAction } from "../../src/enums/prediction-action.ts";
import { PredictionOutcome } from "../../src/enums/prediction-outcome.ts";
import { GitPredictParams } from "../../src/models/git-predict-params.ts";
import { GitPrediction } from "../../src/models/git-prediction.ts";

describe("GitPredictParams", () => {
  const id = "0123456789abcdef0123456789abcdef01234567";

  it("keeps its folder, commit and action, reads back the same, and refuses each field broken and an unknown field", () => {
    const params = new GitPredictParams("/home/a/repo", id, PredictionAction.CherryPick);

    assert.deepEqual(params.toJson(), { folder: "/home/a/repo", id, action: "CherryPick" });
    assert.deepEqual(GitPredictParams.fromJson(params.toJson()), params);
    assert.throws(() => GitPredictParams.fromJson({ folder: "repo", id, action: "Merge" }), { name: "ProtocolFieldException", field: "$.folder" });
    assert.throws(() => GitPredictParams.fromJson({ folder: "/home/a/repo", id: "main", action: "Merge" }), { name: "ProtocolFieldException", field: "$.id" });
    assert.throws(() => GitPredictParams.fromJson({ folder: "/home/a/repo", id, action: "Rebase" }), { name: "JsonException", path: "$.action" });
    assert.throws(() => GitPredictParams.fromJson({ folder: "/home/a/repo", id, action: "Merge", more: 1 }), { name: "ProtocolFieldException" });
  });
});

describe("GitPrediction", () => {
  it("keeps its outcome and conflicting paths and reads back the same", () => {
    const conflicts = new GitPrediction(PredictionOutcome.Conflicts, ["a.txt", "src/b c.ts"]);
    const clean = new GitPrediction(PredictionOutcome.Clean, []);

    assert.deepEqual(conflicts.toJson(), { outcome: "Conflicts", paths: ["a.txt", "src/b c.ts"] });
    assert.deepEqual(GitPrediction.fromJson(conflicts.toJson()), conflicts);
    assert.deepEqual(GitPrediction.fromJson(clean.toJson()), clean);
  });

  it("refuses an unknown outcome, paths that don't match the outcome, a path that isn't relative and an unknown field", () => {
    assert.throws(() => GitPrediction.fromJson({ outcome: "Maybe", paths: [] }), { name: "JsonException", path: "$.outcome" });
    assert.throws(() => GitPrediction.fromJson({ outcome: "Conflicts", paths: [] }), { name: "ProtocolFieldException", field: "$.paths" });
    assert.throws(() => GitPrediction.fromJson({ outcome: "Clean", paths: ["a.txt"] }), { name: "ProtocolFieldException", field: "$.paths" });
    assert.throws(() => GitPrediction.fromJson({ outcome: "Conflicts", paths: ["a.txt", "../b.txt"] }), { name: "ProtocolFieldException", field: "$.paths.1" });
    assert.throws(() => GitPrediction.fromJson({ outcome: "Clean", paths: [], more: 1 }), { name: "ProtocolFieldException" });
  });
});
