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

export class WorkItemQuery {
  private static readonly FIELDS: readonly string[] = [Resources.hostField, Resources.organizationField, Resources.idField];

  public readonly host: string;
  public readonly organization: string;
  public readonly id: number;

  public constructor(host: string, organization: string, id: number, reader?: JsonReader) {
    FieldCheck.requireName(host, Resources.hostField, reader);
    FieldCheck.requireName(organization, Resources.organizationField, reader);
    FieldCheck.requirePositive(id, Resources.idField, reader);

    this.host = host;
    this.organization = organization;
    this.id = id;
  }

  public static fromJson(value: unknown, path?: string): WorkItemQuery {
    const reader = JsonReader.fromValue(value, path);
    FieldCheck.refuseUnknownFields(reader, WorkItemQuery.FIELDS);
    return new WorkItemQuery(reader.readString(Resources.hostField), reader.readString(Resources.organizationField), reader.readInteger(Resources.idField), reader);
  }

  public toJson(): JsonObject {
    return { [Resources.hostField]: this.host, [Resources.organizationField]: this.organization, [Resources.idField]: this.id };
  }
}
