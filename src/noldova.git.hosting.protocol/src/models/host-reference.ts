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

export class HostReference {
  private static readonly FIELDS: readonly string[] = [Resources.hostField, Resources.ownerField, Resources.repositoryField, Resources.numberField, Resources.placeField];

  public readonly host: string;
  public readonly owner: string;
  public readonly repository: string;
  public readonly number: number;
  public readonly place: string | null;

  public constructor(host: string, owner: string, repository: string, number: number, place: string | null = null, reader?: JsonReader) {
    FieldCheck.requireText(host, Resources.hostField, reader);
    FieldCheck.requirePath(owner, Resources.ownerField, reader);
    FieldCheck.requireName(repository, Resources.repositoryField, reader);
    FieldCheck.requirePositive(number, Resources.numberField, reader);
    if (place !== null)
      FieldCheck.requirePlace(place, Resources.placeField, reader);

    this.host = host;
    this.owner = owner;
    this.repository = repository;
    this.number = number;
    this.place = place;
  }

  public get text(): string {
    return Resources.formatReference(this.owner, this.repository, this.number);
  }

  public static fromJson(value: unknown, path?: string): HostReference {
    const reader = JsonReader.fromValue(value, path);
    FieldCheck.refuseUnknownFields(reader, HostReference.FIELDS);
    return new HostReference(
      reader.readString(Resources.hostField),
      reader.readString(Resources.ownerField),
      reader.readString(Resources.repositoryField),
      reader.readInteger(Resources.numberField),
      reader.hasField(Resources.placeField) ? reader.readNullableString(Resources.placeField) : null,
      reader);
  }

  public toJson(): JsonObject {
    return {
      [Resources.hostField]: this.host,
      [Resources.ownerField]: this.owner,
      [Resources.repositoryField]: this.repository,
      [Resources.numberField]: this.number,
      ...(this.place === null ? {} : { [Resources.placeField]: this.place })
    };
  }
}
