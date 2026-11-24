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
import { HostWorkItemDetail } from "./host-work-item-detail.ts";

export class HostWorkItemList {
  private static readonly FIELDS: readonly string[] = [Resources.itemsField, Resources.isTruncatedField];

  public readonly items: readonly HostWorkItemDetail[];
  public readonly isTruncated: boolean;

  public constructor(items: readonly HostWorkItemDetail[], isTruncated: boolean) {
    this.items = [...items];
    this.isTruncated = isTruncated;
  }

  public static fromJson(value: unknown, path?: string): HostWorkItemList {
    const reader = JsonReader.fromValue(value, path);
    FieldCheck.refuseUnknownFields(reader, HostWorkItemList.FIELDS);
    return new HostWorkItemList(reader.readObjectArray(Resources.itemsField).map(t => HostWorkItemDetail.fromJson(t.toJson(), t.path)),
      reader.readBoolean(Resources.isTruncatedField));
  }

  public toJson(): JsonObject {
    return {
      [Resources.itemsField]: this.items.map(t => t.toJson()),
      [Resources.isTruncatedField]: this.isTruncated
    };
  }
}
