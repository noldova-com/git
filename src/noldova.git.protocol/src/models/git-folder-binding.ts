/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { type JsonObject, JsonReader } from "@noldova/context.json";

import { FieldCheck } from "./field-check.ts";
import { GitNames } from "./git-names.ts";

export class GitFolderBinding {
  public readonly folder: string;

  public constructor(folder: string, reader?: JsonReader) {
    FieldCheck.requireFolder(folder, GitNames.folderBinding, reader);

    this.folder = folder;
  }

  public static fromBindings(bindings: unknown, path?: string): GitFolderBinding {
    const reader = JsonReader.fromValue(bindings, path);
    return new GitFolderBinding(reader.readString(GitNames.folderBinding), reader);
  }

  public toJson(): JsonObject {
    return { [GitNames.folderBinding]: this.folder };
  }
}
