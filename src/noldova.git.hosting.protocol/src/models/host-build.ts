/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { type JsonObject, JsonReader } from "@noldova/context.json";

import { CheckState } from "../enums/check-state.ts";
import { Resources } from "../resources.ts";
import { FieldCheck } from "./field-check.ts";

export class HostBuild {
  private static readonly FIELDS: readonly string[] = [Resources.nameField, Resources.stateField, Resources.urlField, Resources.startedAtField,
    Resources.finishedAtField, Resources.numberField];
  private static readonly STATES: readonly CheckState[] = Object.values(CheckState);
  private static readonly FINISHED: readonly CheckState[] = [CheckState.Succeeded, CheckState.Failed, CheckState.Neutral];

  public readonly name: string;
  public readonly state: CheckState;
  public readonly url: string | null;
  public readonly startedAt: number | null;
  public readonly finishedAt: number | null;
  public readonly number: string | null;

  public constructor(name: string, state: CheckState, url: string | null, startedAt: number | null, finishedAt: number | null, number: string | null = null,
    reader?: JsonReader) {
    FieldCheck.requireText(name, Resources.nameField, reader);
    if (!Object.isNull(number))
      FieldCheck.requireText(number, Resources.numberField, reader);
    if (!Object.isNull(url))
      FieldCheck.requireHttps(url, Resources.urlField, reader);
    if (!Object.isNull(startedAt))
      FieldCheck.requirePositive(startedAt, Resources.startedAtField, reader);
    if (HostBuild.FINISHED.includes(state) !== (!Object.isNull(finishedAt)))
      FieldCheck.fail(Resources.finishedAtField, Resources.finishedAtExpected, reader);
    if (!Object.isNull(finishedAt)) {
      FieldCheck.requirePositive(finishedAt, Resources.finishedAtField, reader);
      if (!Object.isNull(startedAt) && finishedAt < startedAt)
        FieldCheck.fail(Resources.finishedAtField, Resources.finishedAtExpected, reader);
    }

    this.name = name;
    this.state = state;
    this.url = url;
    this.startedAt = startedAt;
    this.finishedAt = finishedAt;
    this.number = number;
  }

  public static fromJson(value: unknown, path?: string): HostBuild {
    const reader = JsonReader.fromValue(value, path);
    FieldCheck.refuseUnknownFields(reader, HostBuild.FIELDS);
    return new HostBuild(reader.readString(Resources.nameField), reader.readOneOf(Resources.stateField, HostBuild.STATES),
      reader.readNullableString(Resources.urlField), reader.readNullableInteger(Resources.startedAtField), reader.readNullableInteger(Resources.finishedAtField),
      reader.hasField(Resources.numberField) ? reader.readNullableString(Resources.numberField) : null, reader);
  }

  public toJson(): JsonObject {
    return {
      [Resources.nameField]: this.name,
      [Resources.stateField]: this.state,
      [Resources.urlField]: this.url,
      [Resources.startedAtField]: this.startedAt,
      [Resources.finishedAtField]: this.finishedAt,
      [Resources.numberField]: this.number
    };
  }
}
