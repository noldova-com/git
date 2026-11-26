/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { JsonObject, JsonReader } from "@noldova/context.json";

import { Resources } from "../../resources.ts";

export class CommitPrefixChoice {
  public readonly folder: string;
  public readonly branch: string;
  public readonly id: number;

  public constructor(folder: string, branch: string, id: number) {
    this.folder = folder;
    this.branch = branch;
    this.id = id;
  }

  public static fromJson(reader: JsonReader): CommitPrefixChoice {
    return new CommitPrefixChoice(reader.readNonBlankString(Resources.choiceFolderField), reader.readNonBlankString(Resources.choiceBranchField),
      reader.readInteger(Resources.choiceIdField));
  }

  public isFor(folder: string, branch: string): boolean {
    return this.folder === folder && this.branch === branch;
  }

  public toJson(): JsonObject {
    return { [Resources.choiceFolderField]: this.folder, [Resources.choiceBranchField]: this.branch, [Resources.choiceIdField]: this.id };
  }
}
