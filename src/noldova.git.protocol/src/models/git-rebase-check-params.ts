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
import { RebaseStep } from "./rebase-step.ts";

export class GitRebaseCheckParams {
  private static readonly FIELDS: readonly string[] = [Resources.folderField, Resources.ontoField, Resources.stepsField];

  public readonly folder: string;
  public readonly onto: string;
  public readonly steps: readonly RebaseStep[];

  public constructor(folder: string, onto: string, steps: readonly RebaseStep[], reader?: JsonReader) {
    FieldCheck.requireFolder(folder, Resources.folderField, reader);
    FieldCheck.requireObjectId(onto, Resources.ontoField, reader);
    RebaseStep.requireSteps(steps, reader);

    this.folder = folder;
    this.onto = onto;
    this.steps = [...steps];
  }

  public static fromJson(value: unknown, path?: string): GitRebaseCheckParams {
    const reader = JsonReader.fromValue(value, path);
    FieldCheck.refuseUnknownFields(reader, GitRebaseCheckParams.FIELDS);
    return new GitRebaseCheckParams(reader.readString(Resources.folderField), reader.readString(Resources.ontoField),
      FieldCheck.readModels(reader, Resources.stepsField, RebaseStep.fromJson), reader);
  }

  public toJson(): JsonObject {
    return { [Resources.folderField]: this.folder, [Resources.ontoField]: this.onto, [Resources.stepsField]: this.steps.map(t => t.toJson()) };
  }
}
