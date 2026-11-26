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

export class GitBranchTrack {
  private static readonly FIELDS: readonly string[] = [Resources.branchField, Resources.aheadField, Resources.behindField];

  public readonly branch: string;
  public readonly ahead: number;
  public readonly behind: number;

  public constructor(branch: string, ahead: number, behind: number, reader?: JsonReader) {
    FieldCheck.requireText(branch, Resources.branchField, reader);
    FieldCheck.requireCount(ahead, Resources.aheadField, reader);
    FieldCheck.requireCount(behind, Resources.behindField, reader);

    this.branch = branch;
    this.ahead = ahead;
    this.behind = behind;
  }

  public static fromJson(value: unknown, path?: string): GitBranchTrack {
    const reader = JsonReader.fromValue(value, path);
    FieldCheck.refuseUnknownFields(reader, GitBranchTrack.FIELDS);
    return new GitBranchTrack(reader.readString(Resources.branchField), reader.readInteger(Resources.aheadField), reader.readInteger(Resources.behindField), reader);
  }

  public toJson(): JsonObject {
    return { [Resources.branchField]: this.branch, [Resources.aheadField]: this.ahead, [Resources.behindField]: this.behind };
  }
}
