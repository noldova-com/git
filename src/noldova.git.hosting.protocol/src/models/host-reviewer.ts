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
import { HostPerson } from "./host-person.ts";

export class HostReviewer {
  private static readonly FIELDS: readonly string[] = [Resources.personField, Resources.voteField, Resources.voteLabelField, Resources.isRequiredField];

  public readonly person: HostPerson;
  public readonly vote: number;
  public readonly voteLabel: string;
  public readonly isRequired: boolean;

  public constructor(person: HostPerson, vote: number, voteLabel: string, isRequired: boolean, reader?: JsonReader) {
    if (!Number.isFinite(vote) || vote < -1 || vote > 1)
      FieldCheck.fail(Resources.voteField, Resources.voteExpected, reader);
    FieldCheck.requireText(voteLabel, Resources.voteLabelField, reader);

    this.person = person;
    this.vote = vote;
    this.voteLabel = voteLabel;
    this.isRequired = isRequired;
  }

  public static fromJson(value: unknown, path?: string): HostReviewer {
    const reader = JsonReader.fromValue(value, path);
    FieldCheck.refuseUnknownFields(reader, HostReviewer.FIELDS);
    const person = reader.readObject(Resources.personField);
    return new HostReviewer(HostPerson.fromJson(person.toJson(), person.path), reader.readNumber(Resources.voteField),
      reader.readString(Resources.voteLabelField), reader.readBoolean(Resources.isRequiredField), reader);
  }

  public toJson(): JsonObject {
    return {
      [Resources.personField]: this.person.toJson(),
      [Resources.voteField]: this.vote,
      [Resources.voteLabelField]: this.voteLabel,
      [Resources.isRequiredField]: this.isRequired
    };
  }
}
