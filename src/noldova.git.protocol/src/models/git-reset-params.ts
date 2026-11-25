/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */
import { type JsonObject, JsonReader } from "@noldova/context.json";

import { ResetMode } from "../enums/reset-mode.ts";
import { Resources } from "../resources.ts";
import { FieldCheck } from "./field-check.ts";

/** The parameters of `git.reset`: the folder, the full id of the commit the current branch moves to, what the reset keeps, and the status fingerprint the person saw. */
export class GitResetParams {
  private static readonly FIELDS: readonly string[] = [Resources.folderField, Resources.idField, Resources.modeField, Resources.basedOnField];

  public readonly folder: string;
  public readonly id: string;
  public readonly mode: ResetMode;
  public readonly basedOn: string;

  public constructor(folder: string, id: string, mode: ResetMode, basedOn: string, reader?: JsonReader) {
    FieldCheck.requireFolder(folder, Resources.folderField, reader);
    FieldCheck.requireObjectId(id, Resources.idField, reader);
    FieldCheck.requireText(basedOn, Resources.basedOnField, reader);

    this.folder = folder;
    this.id = id;
    this.mode = mode;
    this.basedOn = basedOn;
  }

  public static fromJson(value: unknown, path?: string): GitResetParams {
    const reader = JsonReader.fromValue(value, path);
    FieldCheck.refuseUnknownFields(reader, GitResetParams.FIELDS);
    return new GitResetParams(
      reader.readString(Resources.folderField),
      reader.readString(Resources.idField),
      reader.readOneOf(Resources.modeField, Object.values(ResetMode)),
      reader.readString(Resources.basedOnField),
      reader);
  }

  public toJson(): JsonObject {
    return { [Resources.folderField]: this.folder, [Resources.idField]: this.id, [Resources.modeField]: this.mode, [Resources.basedOnField]: this.basedOn };
  }
}
