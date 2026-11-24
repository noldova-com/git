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

/** The parameters of `git.undo`: the folder, the journal entry's id and the status fingerprint the person saw. */
export class GitUndoParams {
  private static readonly FIELDS: readonly string[] = [Resources.folderField, Resources.idField, Resources.basedOnField];

  public readonly folder: string;
  public readonly id: string;
  public readonly basedOn: string;

  public constructor(folder: string, id: string, basedOn: string, reader?: JsonReader) {
    FieldCheck.requireFolder(folder, Resources.folderField, reader);
    FieldCheck.requireText(id, Resources.idField, reader);
    FieldCheck.requireLine(id, Resources.idField, reader);
    FieldCheck.requireText(basedOn, Resources.basedOnField, reader);

    this.folder = folder;
    this.id = id;
    this.basedOn = basedOn;
  }

  public static fromJson(value: unknown, path?: string): GitUndoParams {
    const reader = JsonReader.fromValue(value, path);
    FieldCheck.refuseUnknownFields(reader, GitUndoParams.FIELDS);
    return new GitUndoParams(reader.readString(Resources.folderField), reader.readString(Resources.idField), reader.readString(Resources.basedOnField), reader);
  }

  public toJson(): JsonObject {
    return { [Resources.folderField]: this.folder, [Resources.idField]: this.id, [Resources.basedOnField]: this.basedOn };
  }
}
