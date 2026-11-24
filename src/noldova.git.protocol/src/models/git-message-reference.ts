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

/** A commit whose message names references, with their numbers in the order the message first names them. */
export class GitMessageReference {
  private static readonly FIELDS: readonly string[] = [Resources.idField, Resources.numbersField];

  public readonly id: string;
  public readonly numbers: readonly number[];

  public constructor(id: string, numbers: readonly number[], reader?: JsonReader) {
    FieldCheck.requireObjectId(id, Resources.idField, reader);
    if (numbers.length === 0)
      FieldCheck.fail(Resources.numbersField, Resources.referenceNumbersExpected, reader);
    numbers.forEach((number, index) => {
      if (!Number.isSafeInteger(number) || number < 1 || number > Resources.maximumReferenceNumber)
        FieldCheck.fail(Resources.formatItemField(Resources.numbersField, index), Resources.referenceNumberExpected, reader);
    });

    this.id = id;
    this.numbers = [...numbers];
  }

  public static fromJson(value: unknown, path?: string): GitMessageReference {
    const reader = JsonReader.fromValue(value, path);
    FieldCheck.refuseUnknownFields(reader, GitMessageReference.FIELDS);
    return new GitMessageReference(reader.readString(Resources.idField), reader.readNumberArray(Resources.numbersField), reader);
  }

  public toJson(): JsonObject {
    return { [Resources.idField]: this.id, [Resources.numbersField]: [...this.numbers] };
  }
}
