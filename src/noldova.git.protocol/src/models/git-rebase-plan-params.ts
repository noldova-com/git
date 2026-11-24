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

/** The parameters of `git.rebasePlan`: the folder and the full id of the commit the current branch would be rebased onto. */
export class GitRebasePlanParams {
  private static readonly FIELDS: readonly string[] = [Resources.folderField, Resources.ontoField];

  public readonly folder: string;
  public readonly onto: string;

  public constructor(folder: string, onto: string, reader?: JsonReader) {
    FieldCheck.requireFolder(folder, Resources.folderField, reader);
    FieldCheck.requireObjectId(onto, Resources.ontoField, reader);

    this.folder = folder;
    this.onto = onto;
  }

  public static fromJson(value: unknown, path?: string): GitRebasePlanParams {
    const reader = JsonReader.fromValue(value, path);
    FieldCheck.refuseUnknownFields(reader, GitRebasePlanParams.FIELDS);
    return new GitRebasePlanParams(reader.readString(Resources.folderField), reader.readString(Resources.ontoField), reader);
  }

  public toJson(): JsonObject {
    return { [Resources.folderField]: this.folder, [Resources.ontoField]: this.onto };
  }
}
