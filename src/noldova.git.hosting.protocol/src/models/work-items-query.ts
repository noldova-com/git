/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { type JsonObject, JsonReader } from "@noldova/context.json";

import { WorkItemScope } from "../enums/work-item-scope.ts";
import { Resources } from "../resources.ts";
import { FieldCheck } from "./field-check.ts";

export class WorkItemsQuery {
  private static readonly FIELDS: readonly string[] = [Resources.hostField, Resources.organizationField, Resources.projectField, Resources.scopeField,
    Resources.idsField];
  private static readonly SCOPES: readonly WorkItemScope[] = Object.values(WorkItemScope);

  public readonly host: string;
  public readonly organization: string;
  public readonly project: string;
  public readonly scope: WorkItemScope;
  public readonly ids: readonly number[];

  public constructor(host: string, organization: string, project: string, scope: WorkItemScope, ids: readonly number[], reader?: JsonReader) {
    FieldCheck.requireName(host, Resources.hostField, reader);
    FieldCheck.requireName(organization, Resources.organizationField, reader);
    FieldCheck.requireText(project, Resources.projectField, reader);
    if ((ids.length > 0) !== (scope === WorkItemScope.Ids) || new Set(ids).size !== ids.length)
      FieldCheck.fail(Resources.idsField, Resources.idsScopeExpected, reader);
    for (const id of ids)
      FieldCheck.requirePositive(id, Resources.idsField, reader);

    this.host = host;
    this.organization = organization;
    this.project = project;
    this.scope = scope;
    this.ids = [...ids];
  }

  public static fromJson(value: unknown, path?: string): WorkItemsQuery {
    const reader = JsonReader.fromValue(value, path);
    FieldCheck.refuseUnknownFields(reader, WorkItemsQuery.FIELDS);
    return new WorkItemsQuery(reader.readString(Resources.hostField), reader.readString(Resources.organizationField), reader.readString(Resources.projectField),
      reader.readOneOf(Resources.scopeField, WorkItemsQuery.SCOPES), reader.readNumberArray(Resources.idsField), reader);
  }

  public toJson(): JsonObject {
    return {
      [Resources.hostField]: this.host,
      [Resources.organizationField]: this.organization,
      [Resources.projectField]: this.project,
      [Resources.scopeField]: this.scope,
      [Resources.idsField]: [...this.ids]
    };
  }
}
