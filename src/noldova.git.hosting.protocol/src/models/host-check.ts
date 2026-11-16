/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { type JsonObject, JsonReader } from "@noldova/context.json";

import { CheckState } from "../enums/check-state.ts";
import { Resources } from "../resources.ts";
import { FieldCheck } from "./field-check.ts";

export class HostCheck {
  private static readonly FIELDS: readonly string[] = [Resources.nameField, Resources.stateField, Resources.urlField];
  private static readonly STATES: readonly CheckState[] = Object.values(CheckState);

  public readonly name: string;
  public readonly state: CheckState;
  public readonly url: string | null;

  public constructor(name: string, state: CheckState, url: string | null, reader?: JsonReader) {
    FieldCheck.requireText(name, Resources.nameField, reader);
    if (url !== null)
      FieldCheck.requireHttps(url, Resources.urlField, reader);

    this.name = name;
    this.state = state;
    this.url = url;
  }

  public static fromJson(value: unknown, path?: string): HostCheck {
    const reader = JsonReader.fromValue(value, path);
    FieldCheck.refuseUnknownFields(reader, HostCheck.FIELDS);
    return new HostCheck(
      reader.readString(Resources.nameField),
      reader.readOneOf(Resources.stateField, HostCheck.STATES),
      reader.readNullableString(Resources.urlField),
      reader);
  }

  public toJson(): JsonObject {
    return { [Resources.nameField]: this.name, [Resources.stateField]: this.state, [Resources.urlField]: this.url };
  }
}
