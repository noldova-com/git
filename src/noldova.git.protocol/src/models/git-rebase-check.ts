/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { type JsonObject, JsonReader } from "@noldova/context.json";

import { Resources } from "../resources.ts";
import { FieldCheck } from "./field-check.ts";
import { GitRebaseStepCheck } from "./git-rebase-step-check.ts";

export class GitRebaseCheck {
  private static readonly FIELDS: readonly string[] = [Resources.stepsField];

  public readonly steps: readonly GitRebaseStepCheck[];

  public constructor(steps: readonly GitRebaseStepCheck[], reader?: JsonReader) {
    if (steps.length > Resources.maximumRebaseSteps)
      FieldCheck.fail(Resources.stepsField, Resources.rebaseStepsExpected, reader);

    this.steps = [...steps];
  }

  public static fromJson(value: unknown, path?: string): GitRebaseCheck {
    const reader = JsonReader.fromValue(value, path);
    FieldCheck.refuseUnknownFields(reader, GitRebaseCheck.FIELDS);
    return new GitRebaseCheck(FieldCheck.readModels(reader, Resources.stepsField, GitRebaseStepCheck.fromJson), reader);
  }

  public toJson(): JsonObject {
    return { [Resources.stepsField]: this.steps.map(t => t.toJson()) };
  }
}
