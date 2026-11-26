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

export class HostCommitComments {
  public static readonly maximumCount: number = Resources.maximumCommitComments;

  private static readonly FIELDS: readonly string[] = [Resources.countField, Resources.isCappedField, Resources.urlField];

  public readonly count: number;
  public readonly isCapped: boolean;
  public readonly url: string | null;

  public constructor(count: number, isCapped: boolean, url: string | null, reader?: JsonReader) {
    FieldCheck.requireCount(count, Resources.countField, reader);
    if (count > Resources.maximumCommitComments)
      FieldCheck.fail(Resources.countField, Resources.commitCommentsExpected, reader);
    if (isCapped && count === 0)
      FieldCheck.fail(Resources.isCappedField, Resources.commitCommentsCappedExpected, reader);
    if ((count === 0) !== (url === null))
      FieldCheck.fail(Resources.urlField, Resources.commitCommentsUrlExpected, reader);
    if (url !== null)
      FieldCheck.requireHttps(url, Resources.urlField, reader);

    this.count = count;
    this.isCapped = isCapped;
    this.url = url;
  }

  public static none(): HostCommitComments {
    return new HostCommitComments(0, false, null);
  }

  public static fromJson(value: unknown, path?: string): HostCommitComments {
    const reader = JsonReader.fromValue(value, path);
    FieldCheck.refuseUnknownFields(reader, HostCommitComments.FIELDS);
    return new HostCommitComments(reader.readInteger(Resources.countField), reader.readBoolean(Resources.isCappedField), reader.readNullableString(Resources.urlField),
      reader);
  }

  public toJson(): JsonObject {
    return { [Resources.countField]: this.count, [Resources.isCappedField]: this.isCapped, [Resources.urlField]: this.url };
  }
}
