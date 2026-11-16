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

export class DeviceCode {
  private static readonly FIELDS: readonly string[] = [Resources.userCodeField, Resources.verificationUriField, Resources.expiresAtField];

  public readonly userCode: string;
  public readonly verificationUri: string;
  public readonly expiresAt: number;

  public constructor(userCode: string, verificationUri: string, expiresAt: number, reader?: JsonReader) {
    FieldCheck.requireText(userCode, Resources.userCodeField, reader);
    FieldCheck.requireHttps(verificationUri, Resources.verificationUriField, reader);
    FieldCheck.requirePositive(expiresAt, Resources.expiresAtField, reader);

    this.userCode = userCode;
    this.verificationUri = verificationUri;
    this.expiresAt = expiresAt;
  }

  public static fromJson(value: unknown, path?: string): DeviceCode {
    const reader = JsonReader.fromValue(value, path);
    FieldCheck.refuseUnknownFields(reader, DeviceCode.FIELDS);
    return new DeviceCode(
      reader.readString(Resources.userCodeField),
      reader.readString(Resources.verificationUriField),
      reader.readInteger(Resources.expiresAtField),
      reader);
  }

  public toJson(): JsonObject {
    return {
      [Resources.userCodeField]: this.userCode,
      [Resources.verificationUriField]: this.verificationUri,
      [Resources.expiresAtField]: this.expiresAt
    };
  }
}
