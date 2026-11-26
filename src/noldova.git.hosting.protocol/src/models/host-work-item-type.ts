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

export class HostWorkItemType {
  private static readonly FIELDS: readonly string[] = [Resources.nameField, Resources.colorField, Resources.iconField, Resources.imageField];

  public readonly name: string;
  public readonly color: string;
  public readonly icon: string;
  public readonly image: string | null;

  public constructor(name: string, color: string, icon: string, image: string | null = null, reader?: JsonReader) {
    FieldCheck.requireText(name, Resources.nameField, reader);
    if (!Resources.colorPattern.test(color))
      FieldCheck.fail(Resources.colorField, Resources.colorExpected, reader);
    FieldCheck.requireName(icon, Resources.iconField, reader);
    if (image !== null && (image.length > Resources.maximumImageLength || !Resources.svgPattern.test(image)))
      FieldCheck.fail(Resources.imageField, Resources.imageExpected, reader);

    this.name = name;
    this.color = color;
    this.icon = icon;
    this.image = image;
  }

  public static fromJson(value: unknown, path?: string): HostWorkItemType {
    const reader = JsonReader.fromValue(value, path);
    FieldCheck.refuseUnknownFields(reader, HostWorkItemType.FIELDS);
    return new HostWorkItemType(reader.readString(Resources.nameField), reader.readString(Resources.colorField), reader.readString(Resources.iconField),
      reader.hasField(Resources.imageField) ? reader.readNullableString(Resources.imageField) : null, reader);
  }

  public toJson(): JsonObject {
    return { [Resources.nameField]: this.name, [Resources.colorField]: this.color, [Resources.iconField]: this.icon, [Resources.imageField]: this.image };
  }
}
