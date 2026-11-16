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

export class StatusUpstream {
  private static readonly FIELDS: readonly string[] = [Resources.nameField, Resources.aheadField, Resources.behindField, Resources.goneField];

  public readonly name: string;
  public readonly ahead: number;
  public readonly behind: number;
  public readonly gone: boolean;

  public constructor(name: string, ahead: number, behind: number, gone: boolean, reader?: JsonReader) {
    FieldCheck.requireText(name, Resources.nameField, reader);
    FieldCheck.requireCount(ahead, Resources.aheadField, reader);
    FieldCheck.requireCount(behind, Resources.behindField, reader);
    if (gone && ahead !== 0)
      FieldCheck.fail(Resources.aheadField, Resources.upstreamGoneExpected, reader);
    if (gone && behind !== 0)
      FieldCheck.fail(Resources.behindField, Resources.upstreamGoneExpected, reader);

    this.name = name;
    this.ahead = ahead;
    this.behind = behind;
    this.gone = gone;
  }

  public static fromJson(value: unknown, path?: string): StatusUpstream {
    const reader = JsonReader.fromValue(value, path);
    FieldCheck.refuseUnknownFields(reader, StatusUpstream.FIELDS);
    return new StatusUpstream(
      reader.readString(Resources.nameField),
      reader.readInteger(Resources.aheadField),
      reader.readInteger(Resources.behindField),
      reader.readBoolean(Resources.goneField),
      reader);
  }

  public toJson(): JsonObject {
    return {
      [Resources.nameField]: this.name,
      [Resources.aheadField]: this.ahead,
      [Resources.behindField]: this.behind,
      [Resources.goneField]: this.gone
    };
  }
}
