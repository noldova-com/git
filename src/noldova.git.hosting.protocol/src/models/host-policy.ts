/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { type JsonObject, JsonReader } from "@noldova/context.json";

import { PolicyState } from "../enums/policy-state.ts";
import { Resources } from "../resources.ts";
import { FieldCheck } from "./field-check.ts";

export class HostPolicy {
  private static readonly FIELDS: readonly string[] = [Resources.nameField, Resources.stateField, Resources.isBlockingField, Resources.urlField, Resources.buildNumberField];
  private static readonly STATES: readonly PolicyState[] = Object.values(PolicyState);

  public readonly name: string;
  public readonly state: PolicyState;
  public readonly isBlocking: boolean;
  public readonly url: string | null;
  public readonly buildNumber: string | null;

  public constructor(name: string, state: PolicyState, isBlocking: boolean, url: string | null, buildNumber: string | null = null, reader?: JsonReader) {
    FieldCheck.requireText(name, Resources.nameField, reader);
    if (!Object.isNull(url))
      FieldCheck.requireHttps(url, Resources.urlField, reader);
    if (!Object.isNull(buildNumber))
      FieldCheck.requireText(buildNumber, Resources.buildNumberField, reader);

    this.name = name;
    this.state = state;
    this.isBlocking = isBlocking;
    this.url = url;
    this.buildNumber = buildNumber;
  }

  public static fromJson(value: unknown, path?: string): HostPolicy {
    const reader = JsonReader.fromValue(value, path);
    FieldCheck.refuseUnknownFields(reader, HostPolicy.FIELDS);
    return new HostPolicy(reader.readString(Resources.nameField), reader.readOneOf(Resources.stateField, HostPolicy.STATES),
      reader.readBoolean(Resources.isBlockingField), reader.readNullableString(Resources.urlField),
      reader.hasField(Resources.buildNumberField) ? reader.readNullableString(Resources.buildNumberField) : null, reader);
  }

  public toJson(): JsonObject {
    return {
      [Resources.nameField]: this.name, [Resources.stateField]: this.state, [Resources.isBlockingField]: this.isBlocking, [Resources.urlField]: this.url,
      [Resources.buildNumberField]: this.buildNumber
    };
  }
}
