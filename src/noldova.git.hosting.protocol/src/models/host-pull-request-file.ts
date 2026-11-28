/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { type JsonObject, JsonReader } from "@noldova/context.json";

import { FileChangeKind } from "../enums/file-change-kind.ts";
import { Resources } from "../resources.ts";
import { FieldCheck } from "./field-check.ts";

export class HostPullRequestFile {
  private static readonly FIELDS: readonly string[] = [Resources.pathField, Resources.kindField, Resources.previousPathField];
  private static readonly KINDS: readonly FileChangeKind[] = Object.values(FileChangeKind);

  public readonly path: string;
  public readonly kind: FileChangeKind;
  public readonly previousPath: string | null;

  public constructor(path: string, kind: FileChangeKind, previousPath: string | null, reader?: JsonReader) {
    FieldCheck.requireText(path, Resources.pathField, reader);
    if (!Object.isNull(previousPath))
      FieldCheck.requireText(previousPath, Resources.previousPathField, reader);
    if ((!Object.isNull(previousPath)) !== (kind === FileChangeKind.Renamed))
      FieldCheck.fail(Resources.previousPathField, Resources.previousPathExpected, reader);

    this.path = path;
    this.kind = kind;
    this.previousPath = previousPath;
  }

  public static fromJson(value: unknown, path?: string): HostPullRequestFile {
    const reader = JsonReader.fromValue(value, path);
    FieldCheck.refuseUnknownFields(reader, HostPullRequestFile.FIELDS);
    return new HostPullRequestFile(reader.readString(Resources.pathField), reader.readOneOf(Resources.kindField, HostPullRequestFile.KINDS),
      reader.readNullableString(Resources.previousPathField), reader);
  }

  public toJson(): JsonObject {
    return { [Resources.pathField]: this.path, [Resources.kindField]: this.kind, [Resources.previousPathField]: this.previousPath };
  }
}
