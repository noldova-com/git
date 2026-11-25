/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { type JsonObject, JsonReader } from "@noldova/context.json";

import { ConflictKind } from "../enums/conflict-kind.ts";
import { OperationKind } from "../enums/operation-kind.ts";
import { Resources } from "../resources.ts";
import { ConflictSides } from "./conflict-sides.ts";
import { FieldCheck } from "./field-check.ts";

export class GitConflict {
  private static readonly FIELDS: readonly string[] = [Resources.pathField, Resources.kindField, Resources.operationField, Resources.baseField,
    Resources.oursField, Resources.theirsField, Resources.mergedField, Resources.oursLabelField, Resources.theirsLabelField,
    Resources.oursCommitField, Resources.theirsCommitField, Resources.binaryField, Resources.reusedField];

  private static readonly STAGES: Readonly<Record<ConflictKind, ConflictSides>> = {
    [ConflictKind.BothModified]: new ConflictSides(true, true, true),
    [ConflictKind.BothAdded]: new ConflictSides(false, true, true),
    [ConflictKind.BothDeleted]: new ConflictSides(true, false, false),
    [ConflictKind.AddedByUs]: new ConflictSides(false, true, false),
    [ConflictKind.AddedByThem]: new ConflictSides(false, false, true),
    [ConflictKind.DeletedByUs]: new ConflictSides(true, false, true),
    [ConflictKind.DeletedByThem]: new ConflictSides(true, true, false)
  };

  public readonly path: string;
  public readonly kind: ConflictKind;
  public readonly operation: OperationKind | null;
  public readonly base: string | null;
  public readonly ours: string | null;
  public readonly theirs: string | null;
  public readonly merged: string | null;
  public readonly oursLabel: string;
  public readonly theirsLabel: string;
  public readonly oursCommit: string | null;
  public readonly theirsCommit: string | null;
  public readonly binary: boolean;
  public readonly reused: boolean;

  public constructor(path: string, kind: ConflictKind, operation: OperationKind | null, base: string | null, ours: string | null, theirs: string | null,
    merged: string | null, oursLabel: string, theirsLabel: string, oursCommit: string | null, theirsCommit: string | null, binary: boolean, reused: boolean,
    reader?: JsonReader) {
    FieldCheck.requireRelativePath(path, Resources.pathField, reader);
    const sides = GitConflict.STAGES[kind];
    GitConflict.requireSide(base, sides.base, binary, Resources.baseField, reader);
    GitConflict.requireSide(ours, sides.ours, binary, Resources.oursField, reader);
    GitConflict.requireSide(theirs, sides.theirs, binary, Resources.theirsField, reader);
    if ((merged !== null) !== (ours !== null && theirs !== null))
      FieldCheck.fail(Resources.mergedField, Resources.mergedTextExpected, reader);
    if (reused && merged === null)
      FieldCheck.fail(Resources.reusedField, Resources.reusedExpected, reader);
    GitConflict.requireLabel(oursLabel, Resources.oursLabelField, reader);
    GitConflict.requireLabel(theirsLabel, Resources.theirsLabelField, reader);
    GitConflict.requireCommit(oursCommit, Resources.oursCommitField, reader);
    GitConflict.requireCommit(theirsCommit, Resources.theirsCommitField, reader);

    this.path = path;
    this.kind = kind;
    this.operation = operation;
    this.base = base;
    this.ours = ours;
    this.theirs = theirs;
    this.merged = merged;
    this.oursLabel = oursLabel;
    this.theirsLabel = theirsLabel;
    this.oursCommit = oursCommit;
    this.theirsCommit = theirsCommit;
    this.binary = binary;
    this.reused = reused;
  }

  public static fromJson(value: unknown, path?: string): GitConflict {
    const reader = JsonReader.fromValue(value, path);
    FieldCheck.refuseUnknownFields(reader, GitConflict.FIELDS);
    return new GitConflict(
      reader.readString(Resources.pathField),
      reader.readOneOf(Resources.kindField, Object.values(ConflictKind)),
      FieldCheck.readNullableMember(reader, Resources.operationField, Object.values(OperationKind)),
      reader.readNullableString(Resources.baseField),
      reader.readNullableString(Resources.oursField),
      reader.readNullableString(Resources.theirsField),
      reader.readNullableString(Resources.mergedField),
      reader.readString(Resources.oursLabelField),
      reader.readString(Resources.theirsLabelField),
      GitConflict.readCommit(reader, Resources.oursCommitField),
      GitConflict.readCommit(reader, Resources.theirsCommitField),
      reader.readBoolean(Resources.binaryField),
      reader.readBoolean(Resources.reusedField),
      reader);
  }

  public toJson(): JsonObject {
    return {
      [Resources.pathField]: this.path,
      [Resources.kindField]: this.kind,
      [Resources.operationField]: this.operation,
      [Resources.baseField]: this.base,
      [Resources.oursField]: this.ours,
      [Resources.theirsField]: this.theirs,
      [Resources.mergedField]: this.merged,
      [Resources.oursLabelField]: this.oursLabel,
      [Resources.theirsLabelField]: this.theirsLabel,
      [Resources.oursCommitField]: this.oursCommit,
      [Resources.theirsCommitField]: this.theirsCommit,
      [Resources.binaryField]: this.binary,
      [Resources.reusedField]: this.reused
    };
  }

  /** A side's commit, or `null` when the field is `null` or absent, as it is in a conflict an older runtime read. */
  private static readCommit(reader: JsonReader, field: string): string | null {
    return reader.hasField(field) ? reader.readNullableString(field) : null;
  }

  /** Requires a side's text exactly when the kind has the side and the file isn't binary. */
  private static requireSide(value: string | null, has: boolean, binary: boolean, field: string, reader: JsonReader | undefined): void {
    if ((value !== null) !== (has && !binary))
      FieldCheck.fail(field, binary ? Resources.binaryTextExpected : Resources.conflictStageExpected, reader);
  }

  private static requireLabel(label: string, field: string, reader: JsonReader | undefined): void {
    FieldCheck.requireText(label, field, reader);
    FieldCheck.requireLine(label, field, reader);
  }

  private static requireCommit(commit: string | null, field: string, reader: JsonReader | undefined): void {
    if (commit !== null)
      FieldCheck.requireObjectId(commit, field, reader);
  }
}
