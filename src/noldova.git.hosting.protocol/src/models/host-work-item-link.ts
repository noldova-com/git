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
import { HostWorkItemType } from "./host-work-item-type.ts";

export class HostWorkItemLink {
  private static readonly FIELDS: readonly string[] = [Resources.idField, Resources.titleField, Resources.typeField, Resources.stateField, Resources.categoryField,
    Resources.urlField];
  private static readonly CATEGORIES: readonly WorkItemCategory[] = Object.values(WorkItemCategory);

  public readonly id: number;
  public readonly title: string;
  public readonly type: HostWorkItemType;
  public readonly state: string;
  public readonly category: WorkItemCategory;
  public readonly url: string;

  public constructor(id: number, title: string, type: HostWorkItemType, state: string, category: WorkItemCategory, url: string, reader?: JsonReader) {
    FieldCheck.requirePositive(id, Resources.idField, reader);
    FieldCheck.requireText(title, Resources.titleField, reader);
    FieldCheck.requireText(state, Resources.stateField, reader);
    FieldCheck.requireHttps(url, Resources.urlField, reader);

    this.id = id;
    this.title = title;
    this.type = type;
    this.state = state;
    this.category = category;
    this.url = url;
  }

  public static fromJson(value: unknown, path?: string): HostWorkItemLink {
    const reader = JsonReader.fromValue(value, path);
    FieldCheck.refuseUnknownFields(reader, HostWorkItemLink.FIELDS);
    const type = reader.readObject(Resources.typeField);
    return new HostWorkItemLink(
      reader.readInteger(Resources.idField),
      reader.readString(Resources.titleField),
      HostWorkItemType.fromJson(type.toJson(), type.path),
      reader.readString(Resources.stateField),
      reader.readOneOf(Resources.categoryField, HostWorkItemLink.CATEGORIES),
      reader.readString(Resources.urlField),
      reader);
  }

  public toJson(): JsonObject {
    return {
      [Resources.idField]: this.id,
      [Resources.titleField]: this.title,
      [Resources.typeField]: this.type.toJson(),
      [Resources.stateField]: this.state,
      [Resources.categoryField]: this.category,
      [Resources.urlField]: this.url
    };
  }
}
