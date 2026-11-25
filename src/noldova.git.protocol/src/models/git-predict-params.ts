/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { type JsonObject, JsonReader } from "@noldova/context.json";

import { PredictionAction } from "../enums/prediction-action.ts";
import { Resources } from "../resources.ts";
import { FieldCheck } from "./field-check.ts";

/** The parameters of `git.predict`: the folder, the commit's full id and the write the prediction is for. */
export class GitPredictParams {
  private static readonly FIELDS: readonly string[] = [Resources.folderField, Resources.idField, Resources.actionField];

  public readonly folder: string;
  public readonly id: string;
  public readonly action: PredictionAction;

  public constructor(folder: string, id: string, action: PredictionAction, reader?: JsonReader) {
    FieldCheck.requireFolder(folder, Resources.folderField, reader);
    FieldCheck.requireObjectId(id, Resources.idField, reader);

    this.folder = folder;
    this.id = id;
    this.action = action;
  }

  public static fromJson(value: unknown, path?: string): GitPredictParams {
    const reader = JsonReader.fromValue(value, path);
    FieldCheck.refuseUnknownFields(reader, GitPredictParams.FIELDS);
    return new GitPredictParams(
      reader.readString(Resources.folderField),
      reader.readString(Resources.idField),
      reader.readOneOf(Resources.actionField, Object.values(PredictionAction)),
      reader);
  }

  public toJson(): JsonObject {
    return { [Resources.folderField]: this.folder, [Resources.idField]: this.id, [Resources.actionField]: this.action };
  }
}
