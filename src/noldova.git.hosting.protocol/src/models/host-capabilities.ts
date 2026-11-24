/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { type JsonObject, JsonReader } from "@noldova/context.json";

import { HostCapability } from "../enums/host-capability.ts";
import { Resources } from "../resources.ts";
import { FieldCheck } from "./field-check.ts";

export class HostCapabilities {
  private static readonly FIELDS: readonly string[] = [Resources.capabilitiesField];
  private static readonly CAPABILITIES: readonly HostCapability[] = Object.values(HostCapability);

  public readonly capabilities: readonly HostCapability[];

  public constructor(capabilities: readonly HostCapability[], reader?: JsonReader) {
    if (new Set(capabilities).size !== capabilities.length)
      FieldCheck.fail(Resources.capabilitiesField, Resources.eachOnceExpected, reader);

    this.capabilities = [...capabilities];
  }

  public has(capability: HostCapability): boolean {
    return this.capabilities.includes(capability);
  }

  public static fromJson(value: unknown, path?: string): HostCapabilities {
    const reader = JsonReader.fromValue(value, path);
    FieldCheck.refuseUnknownFields(reader, HostCapabilities.FIELDS);
    const names: readonly string[] = reader.readStringArray(Resources.capabilitiesField);
    return new HostCapabilities(names.map(t => FieldCheck.requireMember(t, HostCapabilities.CAPABILITIES, Resources.capabilitiesField, reader)), reader);
  }

  public toJson(): JsonObject {
    return { [Resources.capabilitiesField]: [...this.capabilities] };
  }
}
