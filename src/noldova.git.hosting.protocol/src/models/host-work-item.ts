/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { type JsonObject, JsonReader } from "@noldova/context.json";

import { WorkItemCategory } from "../enums/work-item-category.ts";
import { Resources } from "../resources.ts";
import { FieldCheck } from "./field-check.ts";
import { HostPerson } from "./host-person.ts";
import { HostWorkItemType } from "./host-work-item-type.ts";

export class HostWorkItem {
  private static readonly FIELDS: readonly string[] = [Resources.hostField, Resources.organizationField, Resources.projectField, Resources.idField,
    Resources.typeField, Resources.titleField, Resources.stateField, Resources.categoryField, Resources.urlField, Resources.assigneeField,
    Resources.iterationField, Resources.areaField, Resources.parentField, Resources.changedAtField];
  private static readonly CATEGORIES: readonly WorkItemCategory[] = Object.values(WorkItemCategory);

  public readonly host: string;
  public readonly organization: string;
  public readonly project: string;
  public readonly id: number;
  public readonly type: HostWorkItemType;
  public readonly title: string;
  public readonly state: string;
  public readonly category: WorkItemCategory;
  public readonly url: string;
  public readonly assignee: HostPerson | null;
  public readonly iteration: string | null;
  public readonly area: string | null;
  public readonly parent: number | null;
  public readonly changedAt: number | null;

  public constructor(host: string, organization: string, project: string, id: number, type: HostWorkItemType, title: string, state: string,
    category: WorkItemCategory, url: string, assignee: HostPerson | null, iteration: string | null, area: string | null, parent: number | null,
    changedAt: number | null = null, reader?: JsonReader) {
    FieldCheck.requireName(host, Resources.hostField, reader);
    FieldCheck.requireName(organization, Resources.organizationField, reader);
    FieldCheck.requireText(project, Resources.projectField, reader);
    FieldCheck.requirePositive(id, Resources.idField, reader);
    FieldCheck.requireText(title, Resources.titleField, reader);
    FieldCheck.requireText(state, Resources.stateField, reader);
    FieldCheck.requireHttps(url, Resources.urlField, reader);
    if (iteration !== null)
      FieldCheck.requireText(iteration, Resources.iterationField, reader);
    if (area !== null)
      FieldCheck.requireText(area, Resources.areaField, reader);
    if (parent !== null) {
      FieldCheck.requirePositive(parent, Resources.parentField, reader);
      if (parent === id)
        FieldCheck.fail(Resources.parentField, Resources.parentExpected, reader);
    }
    if (changedAt !== null)
      FieldCheck.requirePositive(changedAt, Resources.changedAtField, reader);

    this.host = host;
    this.organization = organization;
    this.project = project;
    this.id = id;
    this.type = type;
    this.title = title;
    this.state = state;
    this.category = category;
    this.url = url;
    this.assignee = assignee;
    this.iteration = iteration;
    this.area = area;
    this.parent = parent;
    this.changedAt = changedAt;
  }

  public static fromJson(value: unknown, path?: string): HostWorkItem {
    const reader = JsonReader.fromValue(value, path);
    FieldCheck.refuseUnknownFields(reader, HostWorkItem.FIELDS);
    const type = reader.readObject(Resources.typeField);
    return new HostWorkItem(
      reader.readString(Resources.hostField),
      reader.readString(Resources.organizationField),
      reader.readString(Resources.projectField),
      reader.readInteger(Resources.idField),
      HostWorkItemType.fromJson(type.toJson(), type.path),
      reader.readString(Resources.titleField),
      reader.readString(Resources.stateField),
      reader.readOneOf(Resources.categoryField, HostWorkItem.CATEGORIES),
      reader.readString(Resources.urlField),
      FieldCheck.readNullableModel(reader, Resources.assigneeField, HostPerson.fromJson),
      reader.readNullableString(Resources.iterationField),
      reader.readNullableString(Resources.areaField),
      reader.readNullableInteger(Resources.parentField),
      reader.hasField(Resources.changedAtField) ? reader.readNullableInteger(Resources.changedAtField) : null,
      reader);
  }

  public toJson(): JsonObject {
    return {
      [Resources.hostField]: this.host,
      [Resources.organizationField]: this.organization,
      [Resources.projectField]: this.project,
      [Resources.idField]: this.id,
      [Resources.typeField]: this.type.toJson(),
      [Resources.titleField]: this.title,
      [Resources.stateField]: this.state,
      [Resources.categoryField]: this.category,
      [Resources.urlField]: this.url,
      [Resources.assigneeField]: this.assignee?.toJson() ?? null,
      [Resources.iterationField]: this.iteration,
      [Resources.areaField]: this.area,
      [Resources.parentField]: this.parent,
      [Resources.changedAtField]: this.changedAt
    };
  }
}
