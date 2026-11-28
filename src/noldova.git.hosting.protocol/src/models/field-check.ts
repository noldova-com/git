/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { JsonReader } from "@noldova/context.json";

import { HostingArgumentException } from "../exceptions/hosting-argument.exception.ts";
import { HostingFieldException } from "../exceptions/hosting-field.exception.ts";
import { Resources } from "../resources.ts";

export class FieldCheck {
  public static fail(field: string, expectation: string, reader?: JsonReader): never {
    if (reader === undefined)
      throw new HostingArgumentException(field, expectation);
    throw new HostingFieldException(Resources.formatFieldPath(reader.path, field), expectation);
  }

  public static refuseUnknownFields(reader: JsonReader, known: readonly string[]): void {
    for (const field of Object.keys(reader.toJson()))
      if (!known.includes(field))
        FieldCheck.fail(field, Resources.unknownField, reader);
  }

  public static readNullableModel<T>(reader: JsonReader, field: string, fromJson: (value: unknown, path: string) => T): T | null {
    const child: JsonReader | null = reader.readNullableObject(field);
    return child === null ? null : fromJson(child.toJson(), child.path);
  }

  public static readNullableMember<T extends string>(reader: JsonReader, field: string, members: readonly T[]): T | null {
    return reader.readValue(field) === null ? null : reader.readOneOf(field, members);
  }

  public static requireMember<T extends string>(value: string, members: readonly T[], field: string, reader?: JsonReader): T {
    const member: T | undefined = members.find(t => t === value);
    if (member === undefined)
      FieldCheck.fail(field, Resources.formatMemberExpected(members), reader);
    return member;
  }

  public static requireText(value: string, field: string, reader?: JsonReader): void {
    if (value.trim().length === 0)
      FieldCheck.fail(field, Resources.nonBlankTextExpected, reader);
  }

  public static requireServer(value: string, field: string, reader?: JsonReader): void {
    if (!Resources.serverPattern.test(value))
      FieldCheck.fail(field, Resources.serverExpected, reader);
  }

  public static requirePositive(value: number, field: string, reader?: JsonReader): void {
    if (!Number.isSafeInteger(value) || value < 1)
      FieldCheck.fail(field, Resources.positiveExpected, reader);
  }

  public static requireCount(value: number, field: string, reader?: JsonReader): void {
    if (!Number.isSafeInteger(value) || value < 0)
      FieldCheck.fail(field, Resources.countExpected, reader);
  }

  public static requireName(value: string, field: string, reader?: JsonReader): void {
    if (!Resources.namePattern.test(value))
      FieldCheck.fail(field, Resources.nameExpected, reader);
  }

  public static requirePath(value: string, field: string, reader?: JsonReader): void {
    if (!Resources.pathPattern.test(value))
      FieldCheck.fail(field, Resources.pathExpected, reader);
  }

  public static requireCommit(value: string, field: string, reader?: JsonReader): void {
    if (!Resources.commitPattern.test(value))
      FieldCheck.fail(field, Resources.commitExpected, reader);
  }

  public static requireAvatar(value: string, field: string, reader?: JsonReader): void {
    const payload: string | undefined = Resources.avatarPattern.exec(value)?.[1];
    if (payload === undefined || payload.length === 0 || payload.length > Resources.maximumAvatarLength)
      FieldCheck.fail(field, Resources.avatarExpected, reader);
  }

  public static requireHttps(value: string, field: string, reader?: JsonReader): void {
    const url: URL | null = URL.parse(value);
    if (url === null || url.protocol !== Resources.httpsProtocol || url.username.length > 0 || url.password.length > 0)
      FieldCheck.fail(field, Resources.httpsAddressExpected, reader);
  }
}
