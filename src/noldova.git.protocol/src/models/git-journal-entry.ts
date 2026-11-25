/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */
import { type JsonObject, JsonReader } from "@noldova/context.json";

import { UndoMode } from "../enums/undo-mode.ts";
import { Resources } from "../resources.ts";
import { FieldCheck } from "./field-check.ts";
import { GitRefMove } from "./git-ref-move.ts";

/**
 * One write in a repository's journal: its id, the method that wrote, when, the branch checked out before and after (null when detached or
 * unborn), the refs it moved, how it is undone, for an index write the index's tree before and after, and for a discard the checkpoint
 * taken before it with the paths an undo puts back from it.
 */
export class GitJournalEntry {
  private static readonly FIELDS: readonly string[] = [
    Resources.idField, Resources.methodField, Resources.atField, Resources.branchField, Resources.branchAfterField, Resources.movesField, Resources.undoField,
    Resources.indexBeforeField, Resources.indexAfterField, Resources.checkpointField, Resources.pathsField
  ];

  public readonly id: string;
  public readonly method: string;
  public readonly at: string;
  public readonly branch: string | null;
  public readonly branchAfter: string | null;
  public readonly moves: readonly GitRefMove[];
  public readonly undo: UndoMode;
  public readonly indexBefore: string | null;
  public readonly indexAfter: string | null;
  public readonly checkpoint: string | null;
  public readonly paths: readonly string[];

  public constructor(
    id: string,
    method: string,
    at: string,
    branch: string | null,
    branchAfter: string | null,
    moves: readonly GitRefMove[],
    undo: UndoMode,
    indexBefore: string | null,
    indexAfter: string | null,
    checkpoint: string | null = null,
    paths: readonly string[] = [],
    reader?: JsonReader) {
    FieldCheck.requireText(id, Resources.idField, reader);
    FieldCheck.requireLine(id, Resources.idField, reader);
    FieldCheck.requireText(method, Resources.methodField, reader);
    FieldCheck.requireLine(method, Resources.methodField, reader);
    if (!Resources.dateTimePattern.test(at) || Number.isNaN(Date.parse(at)))
      FieldCheck.fail(Resources.atField, Resources.dateTimeExpected, reader);
    if (branch !== null)
      FieldCheck.requireBranchName(branch, Resources.branchField, reader);
    if (branchAfter !== null)
      FieldCheck.requireBranchName(branchAfter, Resources.branchAfterField, reader);
    if (indexBefore !== null)
      FieldCheck.requireObjectId(indexBefore, Resources.indexBeforeField, reader);
    if (indexAfter !== null)
      FieldCheck.requireObjectId(indexAfter, Resources.indexAfterField, reader);
    if ((undo === UndoMode.Index) !== (indexBefore !== null && indexAfter !== null) || (indexBefore === null) !== (indexAfter === null))
      FieldCheck.fail(Resources.indexAfterField, Resources.indexTreesExpected, reader);
    if (checkpoint !== null) {
      FieldCheck.requireText(checkpoint, Resources.checkpointField, reader);
      FieldCheck.requireLine(checkpoint, Resources.checkpointField, reader);
    }
    paths.forEach((path, index) => FieldCheck.requireRelativePath(path, Resources.formatItemField(Resources.pathsField, index), reader));
    if ((undo === UndoMode.Checkpoint || undo === UndoMode.Stash) !== (checkpoint !== null) || (undo === UndoMode.Checkpoint) !== (paths.length > 0))
      FieldCheck.fail(Resources.checkpointField, Resources.checkpointExpected, reader);
    if (undo === UndoMode.Stash && checkpoint !== null)
      FieldCheck.requireObjectId(checkpoint, Resources.checkpointField, reader);

    this.id = id;
    this.method = method;
    this.at = at;
    this.branch = branch;
    this.branchAfter = branchAfter;
    this.moves = moves;
    this.undo = undo;
    this.indexBefore = indexBefore;
    this.indexAfter = indexAfter;
    this.checkpoint = checkpoint;
    this.paths = paths;
  }

  public static fromJson(value: unknown, path?: string): GitJournalEntry {
    const reader = JsonReader.fromValue(value, path);
    FieldCheck.refuseUnknownFields(reader, GitJournalEntry.FIELDS);
    return new GitJournalEntry(
      reader.readString(Resources.idField),
      reader.readString(Resources.methodField),
      reader.readString(Resources.atField),
      reader.readNullableString(Resources.branchField),
      reader.readNullableString(Resources.branchAfterField),
      FieldCheck.readModels(reader, Resources.movesField, GitRefMove.fromJson),
      reader.readOneOf(Resources.undoField, Object.values(UndoMode)),
      reader.readNullableString(Resources.indexBeforeField),
      reader.readNullableString(Resources.indexAfterField),
      reader.readNullableString(Resources.checkpointField),
      reader.readStringArray(Resources.pathsField),
      reader);
  }

  public toJson(): JsonObject {
    return {
      [Resources.idField]: this.id,
      [Resources.methodField]: this.method,
      [Resources.atField]: this.at,
      [Resources.branchField]: this.branch,
      [Resources.branchAfterField]: this.branchAfter,
      [Resources.movesField]: this.moves.map(t => t.toJson()),
      [Resources.undoField]: this.undo,
      [Resources.indexBeforeField]: this.indexBefore,
      [Resources.indexAfterField]: this.indexAfter,
      [Resources.checkpointField]: this.checkpoint,
      [Resources.pathsField]: [...this.paths]
    };
  }
}
