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
import { GitPredictParams } from "../../src/models/git-predict-params.ts";
import type { IFieldFailure } from "../fixtures/field-failure.fixture.ts";

const expected = (field: string, expectation: string): IFieldFailure =>
  ({ name: "ProtocolFieldException", field, message: `The field ${field} is invalid: expected ${expectation}.` });

describe("GitPredictParams", () => {
  const id = "0123456789abcdef0123456789abcdef01234567";

  it("keeps its folder, commit and action, and reads back the same for each action", () => {
    const params = new GitPredictParams("/home/a/repo", id, PredictionAction.CherryPick);

    assert.deepEqual(params.toJson(), { folder: "/home/a/repo", id, action: "CherryPick" });
    for (const action of [PredictionAction.Merge, PredictionAction.CherryPick, PredictionAction.Revert]) {
      const each = new GitPredictParams("/r", id, action);
      assert.deepEqual(GitPredictParams.fromJson(JSON.parse(JSON.stringify(each.toJson()))), each);
    }
  });

  it("refuses a relative folder and an id that isn't a full object id, naming its path", () => {
    assert.throws(() => GitPredictParams.fromJson({ folder: "repo", id, action: "Merge" }), expected("$.folder", "an absolute path of at most 4096 characters"));
    assert.throws(() => GitPredictParams.fromJson({ folder: "/r", id: "HEAD", action: "Merge" }), expected("$.id", "a full hexadecimal object id"));
    assert.throws(() => new GitPredictParams("/r", "", PredictionAction.Revert), expected("id", "a full hexadecimal object id"));
  });

  it("refuses an unknown action and a field it doesn't define", () => {
    assert.throws(() => GitPredictParams.fromJson({ folder: "/r", id, action: "Rebase" }), { name: "JsonException", path: "$.action" });
    assert.throws(() => GitPredictParams.fromJson({ folder: "/r", id, action: "Merge", more: 1 }), expected("$.more", "none, since the model doesn't define it"));
  });
});
