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

/** `git.markerCheck`'s answer: the tracked files, staged or not, that still have a conflict marker line, as `git diff --check` finds them, each once. */
export class GitMarkerCheck {
  private static readonly FIELDS: readonly string[] = [Resources.pathsField];

  public readonly paths: readonly string[];

  public constructor(paths: readonly string[], reader?: JsonReader) {
    if (paths.length > Resources.maximumPathCount)
      FieldCheck.fail(Resources.pathsField, Resources.diffPathCountExpected, reader);
    paths.forEach((path, index) => FieldCheck.requireRelativePath(path, Resources.formatItemField(Resources.pathsField, index), reader));

    this.paths = [...paths];
  }

  public static fromJson(value: unknown, path?: string): GitMarkerCheck {
    const reader = JsonReader.fromValue(value, path);
    FieldCheck.refuseUnknownFields(reader, GitMarkerCheck.FIELDS);
    return new GitMarkerCheck(reader.readStringArray(Resources.pathsField), reader);
  }

  public toJson(): JsonObject {
    return { [Resources.pathsField]: [...this.paths] };
  }
}
