/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { type JsonObject, JsonReader } from "@noldova/context.json";

import { PredictionOutcome } from "../enums/prediction-outcome.ts";
import { Resources } from "../resources.ts";
import { FieldCheck } from "./field-check.ts";

/** `git.predict`'s answer: what the write would do, and the paths that would conflict, which only `Conflicts` has. */
export class GitPrediction {
  private static readonly FIELDS: readonly string[] = [Resources.outcomeField, Resources.pathsField];

  public readonly outcome: PredictionOutcome;
  public readonly paths: readonly string[];

  public constructor(outcome: PredictionOutcome, paths: readonly string[], reader?: JsonReader) {
    if (!Object.values(PredictionOutcome).includes(outcome))
      FieldCheck.fail(Resources.outcomeField, Resources.predictionOutcomeExpected, reader);
    if ((outcome === PredictionOutcome.Conflicts) !== (paths.length > 0))
      FieldCheck.fail(Resources.pathsField, Resources.predictionPathsExpected, reader);
    paths.forEach((path, index) => FieldCheck.requireRelativePath(path, Resources.formatItemField(Resources.pathsField, index), reader));

    this.outcome = outcome;
    this.paths = [...paths];
  }

  public static fromJson(value: unknown, path?: string): GitPrediction {
    const reader = JsonReader.fromValue(value, path);
    FieldCheck.refuseUnknownFields(reader, GitPrediction.FIELDS);
    return new GitPrediction(reader.readOneOf(Resources.outcomeField, Object.values(PredictionOutcome)), reader.readStringArray(Resources.pathsField), reader);
  }

  public toJson(): JsonObject {
    return { [Resources.outcomeField]: this.outcome, [Resources.pathsField]: [...this.paths] };
  }
}
