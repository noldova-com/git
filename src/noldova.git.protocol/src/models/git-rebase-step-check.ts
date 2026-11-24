/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { type JsonObject, JsonReader } from "@noldova/context.json";

import { RebaseCheckOutcome } from "../enums/rebase-check-outcome.ts";
import { Resources } from "../resources.ts";
import { FieldCheck } from "./field-check.ts";

/** What one step would do: its outcome, and the paths that would conflict, which only `Conflicts` has. */
export class GitRebaseStepCheck {
  private static readonly FIELDS: readonly string[] = [Resources.outcomeField, Resources.pathsField];

  public readonly outcome: RebaseCheckOutcome;
  public readonly paths: readonly string[];

  public constructor(outcome: RebaseCheckOutcome, paths: readonly string[], reader?: JsonReader) {
    if (!Object.values(RebaseCheckOutcome).includes(outcome))
      FieldCheck.fail(Resources.outcomeField, Resources.rebaseOutcomeExpected, reader);
    if ((outcome === RebaseCheckOutcome.Conflicts) !== (paths.length > 0))
      FieldCheck.fail(Resources.pathsField, Resources.predictionPathsExpected, reader);
    paths.forEach((path, index) => FieldCheck.requireRelativePath(path, Resources.formatItemField(Resources.pathsField, index), reader));

    this.outcome = outcome;
    this.paths = [...paths];
  }

  public static fromJson(value: unknown, path?: string): GitRebaseStepCheck {
    const reader = JsonReader.fromValue(value, path);
    FieldCheck.refuseUnknownFields(reader, GitRebaseStepCheck.FIELDS);
    return new GitRebaseStepCheck(reader.readOneOf(Resources.outcomeField, Object.values(RebaseCheckOutcome)), reader.readStringArray(Resources.pathsField), reader);
  }

  public toJson(): JsonObject {
    return { [Resources.outcomeField]: this.outcome, [Resources.pathsField]: [...this.paths] };
  }
}
