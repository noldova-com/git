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
import { GitJournalEntry } from "./git-journal-entry.ts";

export class GitJournal {
  private static readonly FIELDS: readonly string[] = [Resources.entriesField, Resources.checkpointsField];

  public readonly entries: readonly GitJournalEntry[];
  public readonly checkpoints: boolean;

  public constructor(entries: readonly GitJournalEntry[], checkpoints: boolean = false, reader?: JsonReader) {
    if (entries.length > Resources.maximumJournalEntries)
      FieldCheck.fail(Resources.entriesField, Resources.journalEntriesExpected, reader);

    this.entries = entries;
    this.checkpoints = checkpoints;
  }

  public static fromJson(value: unknown, path?: string): GitJournal {
    const reader = JsonReader.fromValue(value, path);
    FieldCheck.refuseUnknownFields(reader, GitJournal.FIELDS);
    return new GitJournal(FieldCheck.readModels(reader, Resources.entriesField, GitJournalEntry.fromJson), reader.readBoolean(Resources.checkpointsField), reader);
  }

  public toJson(): JsonObject {
    return { [Resources.entriesField]: this.entries.map(t => t.toJson()), [Resources.checkpointsField]: this.checkpoints };
  }
}
