/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { PredictionAction } from "@noldova/git.protocol";
import { describe, expect, it } from "vitest";

import { GitPredictionAsk } from "../../../src/app/models/git-prediction-ask.ts";

describe("GitPredictionAsk", () => {
  it("holds an action's label and the action Git predicts", () => {
    const value: GitPredictionAsk = new GitPredictionAsk("Revert", PredictionAction.Revert);

    expect([value.label, value.action]).toEqual(["Revert", PredictionAction.Revert]);
  });
});
