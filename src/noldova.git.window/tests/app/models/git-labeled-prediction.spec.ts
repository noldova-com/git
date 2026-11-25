/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { GitPrediction, PredictionOutcome } from "@noldova/git.protocol";
import { describe, expect, it } from "vitest";

import { GitLabeledPrediction } from "../../../src/app/models/git-labeled-prediction.ts";

describe("GitLabeledPrediction", () => {
  it("holds an action's label and what it would do", () => {
    const prediction: GitPrediction = new GitPrediction(PredictionOutcome.Clean, []);
    const value: GitLabeledPrediction = new GitLabeledPrediction("Merge", prediction);

    expect([value.label, value.prediction]).toEqual(["Merge", prediction]);
  });
});
