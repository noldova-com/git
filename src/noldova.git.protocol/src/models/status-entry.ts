/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { type JsonObject, JsonReader } from "@noldova/context.json";

import { ConflictKind } from "../enums/conflict-kind.ts";
import { FileState } from "../enums/file-state.ts";
import { Resources } from "../resources.ts";
import { FieldCheck } from "./field-check.ts";
import { LineCounts } from "./line-counts.ts";
import { SubmoduleStatus } from "./submodule-status.ts";

export class StatusEntry {
  private static readonly FIELDS: readonly string[] = [
    Resources.pathField,
    Resources.pathBytesField,
    Resources.originalPathField,
    Resources.originalPathBytesField,
    Resources.indexField,
    Resources.worktreeField,
    Resources.conflictField,
    Resources.submoduleField,
    Resources.indexCountsField,
    Resources.worktreeCountsField
  ];
  private static readonly MOVED: readonly FileState[] = [FileState.Renamed, FileState.Copied];

  public readonly path: string;
  public readonly pathBytes: string | undefined;
  public readonly originalPath: string | null;
  public readonly originalPathBytes: string | undefined;
  public readonly index: FileState;
  public readonly worktree: FileState;
  public readonly conflict: ConflictKind | null;
  public readonly submodule: SubmoduleStatus | null;
  public readonly indexCounts: LineCounts | null;
  public readonly worktreeCounts: LineCounts | null;

  public constructor(
    path: string,
    pathBytes: string | undefined,
    originalPath: string | null,
    originalPathBytes: string | undefined,
    index: FileState,
    worktree: FileState,
    conflict: ConflictKind | null,
    submodule: SubmoduleStatus | null,
    indexCounts: LineCounts | null,
    worktreeCounts: LineCounts | null,
    reader?: JsonReader) {
    FieldCheck.requireText(path, Resources.pathField, reader);
    FieldCheck.requirePathBytes(pathBytes, Resources.pathBytesField, reader);
    if ((StatusEntry.MOVED.includes(index) || StatusEntry.MOVED.includes(worktree)) !== (!Object.isNull(originalPath)))
      FieldCheck.fail(Resources.originalPathField, Resources.originalPathExpected, reader);
    if (Object.isNull(originalPath))
      FieldCheck.requireAbsent(originalPathBytes, Resources.originalPathBytesField, reader);
    else
      FieldCheck.requireText(originalPath, Resources.originalPathField, reader);
    FieldCheck.requirePathBytes(originalPathBytes, Resources.originalPathBytesField, reader);
    if (!Object.isNull(conflict))
      for (const [state, field] of [[index, Resources.indexField], [worktree, Resources.worktreeField]] as const)
        if (state !== FileState.Unmodified)
          FieldCheck.fail(field, Resources.conflictStatesExpected, reader);

    this.path = path;
    this.pathBytes = pathBytes;
    this.originalPath = originalPath;
    this.originalPathBytes = originalPathBytes;
    this.index = index;
    this.worktree = worktree;
    this.conflict = conflict;
    this.submodule = submodule;
    this.indexCounts = indexCounts;
    this.worktreeCounts = worktreeCounts;
  }

  public static fromJson(value: unknown, path?: string): StatusEntry {
    const reader = JsonReader.fromValue(value, path);
    FieldCheck.refuseUnknownFields(reader, StatusEntry.FIELDS);
    const states = Object.values(FileState);
    return new StatusEntry(
      reader.readString(Resources.pathField),
      reader.readOptionalString(Resources.pathBytesField),
      reader.readNullableString(Resources.originalPathField),
      reader.readOptionalString(Resources.originalPathBytesField),
      reader.readOneOf(Resources.indexField, states),
      reader.readOneOf(Resources.worktreeField, states),
      FieldCheck.readNullableMember(reader, Resources.conflictField, Object.values(ConflictKind)),
      FieldCheck.readNullableModel(reader, Resources.submoduleField, SubmoduleStatus.fromJson),
      FieldCheck.readNullableModel(reader, Resources.indexCountsField, LineCounts.fromJson),
      FieldCheck.readNullableModel(reader, Resources.worktreeCountsField, LineCounts.fromJson),
      reader);
  }

  public toJson(): JsonObject {
    return {
      [Resources.pathField]: this.path,
      ...Object.isUndefined(this.pathBytes) ? {} : { [Resources.pathBytesField]: this.pathBytes },
      [Resources.originalPathField]: this.originalPath,
      ...Object.isUndefined(this.originalPathBytes) ? {} : { [Resources.originalPathBytesField]: this.originalPathBytes },
      [Resources.indexField]: this.index,
      [Resources.worktreeField]: this.worktree,
      [Resources.conflictField]: this.conflict,
      [Resources.submoduleField]: this.submodule?.toJson() ?? null,
      [Resources.indexCountsField]: this.indexCounts?.toJson() ?? null,
      [Resources.worktreeCountsField]: this.worktreeCounts?.toJson() ?? null
    };
  }
}
