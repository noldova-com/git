/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { type JsonObject, JsonReader } from "@noldova/context.json";

import { Resources } from "../resources.ts";
import { FieldCheck } from "./field-check.ts";

export class WorkItemUpdate {
  private static readonly FIELDS: readonly string[] = [Resources.hostField, Resources.organizationField, Resources.idField, Resources.stateField,
    Resources.assignToMeField];

  public readonly host: string;
  public readonly organization: string;
  public readonly id: number;
  public readonly state: string | null;
  public readonly assignToMe: boolean;

  public constructor(host: string, organization: string, id: number, state: string | null, assignToMe: boolean, reader?: JsonReader) {
    FieldCheck.requireName(host, Resources.hostField, reader);
    FieldCheck.requireName(organization, Resources.organizationField, reader);
    FieldCheck.requirePositive(id, Resources.idField, reader);
    if (!Object.isNull(state))
      FieldCheck.requireText(state, Resources.stateField, reader);
    else if (!assignToMe)
      FieldCheck.fail(Resources.stateField, Resources.changeExpected, reader);

    this.host = host;
    this.organization = organization;
    this.id = id;
    this.state = state;
    this.assignToMe = assignToMe;
  }

  public static fromJson(value: unknown, path?: string): WorkItemUpdate {
    const reader = JsonReader.fromValue(value, path);
    FieldCheck.refuseUnknownFields(reader, WorkItemUpdate.FIELDS);
    return new WorkItemUpdate(reader.readString(Resources.hostField), reader.readString(Resources.organizationField), reader.readInteger(Resources.idField),
      reader.readNullableString(Resources.stateField), reader.readBoolean(Resources.assignToMeField), reader);
  }

  public toJson(): JsonObject {
    return {
      [Resources.hostField]: this.host,
      [Resources.organizationField]: this.organization,
      [Resources.idField]: this.id,
      [Resources.stateField]: this.state,
      [Resources.assignToMeField]: this.assignToMe
    };
  }
}
