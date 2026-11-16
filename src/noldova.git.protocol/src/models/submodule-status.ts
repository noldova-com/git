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

export class SubmoduleStatus {
  private static readonly FIELDS: readonly string[] = [Resources.commitChangedField, Resources.trackedChangesField, Resources.untrackedChangesField];

  public readonly commitChanged: boolean;
  public readonly trackedChanges: boolean;
  public readonly untrackedChanges: boolean;

  public constructor(commitChanged: boolean, trackedChanges: boolean, untrackedChanges: boolean) {
    this.commitChanged = commitChanged;
    this.trackedChanges = trackedChanges;
    this.untrackedChanges = untrackedChanges;
  }

  public static fromJson(value: unknown, path?: string): SubmoduleStatus {
    const reader = JsonReader.fromValue(value, path);
    FieldCheck.refuseUnknownFields(reader, SubmoduleStatus.FIELDS);
    return new SubmoduleStatus(
      reader.readBoolean(Resources.commitChangedField),
      reader.readBoolean(Resources.trackedChangesField),
      reader.readBoolean(Resources.untrackedChangesField));
  }

  public toJson(): JsonObject {
    return {
      [Resources.commitChangedField]: this.commitChanged,
      [Resources.trackedChangesField]: this.trackedChanges,
      [Resources.untrackedChangesField]: this.untrackedChanges
    };
  }
}
