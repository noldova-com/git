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
import { HostReference } from "./host-reference.ts";

export class HostReviewRequest {
  private static readonly FIELDS: readonly string[] = [Resources.referenceField, Resources.titleField, Resources.urlField, Resources.isDraftField,
    Resources.createdAtField];

  public readonly reference: HostReference;
  public readonly title: string;
  public readonly url: string;
  public readonly isDraft: boolean;
  /** When it was opened, in milliseconds since the Unix epoch. */
  public readonly createdAt: number;

  public constructor(reference: HostReference, title: string, url: string, isDraft: boolean, createdAt: number, reader?: JsonReader) {
    FieldCheck.requireText(title, Resources.titleField, reader);
    FieldCheck.requireHttps(url, Resources.urlField, reader);
    FieldCheck.requirePositive(createdAt, Resources.createdAtField, reader);

    this.reference = reference;
    this.title = title;
    this.url = url;
    this.isDraft = isDraft;
    this.createdAt = createdAt;
  }

  public static fromJson(value: unknown, path?: string): HostReviewRequest {
    const reader = JsonReader.fromValue(value, path);
    FieldCheck.refuseUnknownFields(reader, HostReviewRequest.FIELDS);
    const reference = reader.readObject(Resources.referenceField);
    return new HostReviewRequest(
      HostReference.fromJson(reference.toJson(), reference.path),
      reader.readString(Resources.titleField),
      reader.readString(Resources.urlField),
      reader.readBoolean(Resources.isDraftField),
      reader.readInteger(Resources.createdAtField),
      reader);
  }

  public toJson(): JsonObject {
    return {
      [Resources.referenceField]: this.reference.toJson(),
      [Resources.titleField]: this.title,
      [Resources.urlField]: this.url,
      [Resources.isDraftField]: this.isDraft,
      [Resources.createdAtField]: this.createdAt
    };
  }
}
