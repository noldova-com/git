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

/** A fetch of a folder on the status it is based on: of the current branch's remote, or of every remote with `allRemotes`, which is false when left out. */
export class GitFetchParams {
  private static readonly FIELDS: readonly string[] = [Resources.folderField, Resources.basedOnField, Resources.allRemotesField];

  public readonly folder: string;
  public readonly basedOn: string;
  public readonly allRemotes: boolean;

  public constructor(folder: string, basedOn: string, allRemotes: boolean = false, reader?: JsonReader) {
    FieldCheck.requireFolder(folder, Resources.folderField, reader);
    FieldCheck.requireText(basedOn, Resources.basedOnField, reader);

    this.folder = folder;
    this.basedOn = basedOn;
    this.allRemotes = allRemotes;
  }

  public static fromJson(value: unknown, path?: string): GitFetchParams {
    const reader = JsonReader.fromValue(value, path);
    FieldCheck.refuseUnknownFields(reader, GitFetchParams.FIELDS);
    return new GitFetchParams(reader.readString(Resources.folderField), reader.readString(Resources.basedOnField),
      reader.hasField(Resources.allRemotesField) ? reader.readBoolean(Resources.allRemotesField) : false, reader);
  }

  public toJson(): JsonObject {
    return {
      [Resources.folderField]: this.folder,
      [Resources.basedOnField]: this.basedOn,
      ...this.allRemotes ? { [Resources.allRemotesField]: true } : {}
    };
  }
}
