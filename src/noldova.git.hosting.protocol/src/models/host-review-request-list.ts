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
import { HostReviewRequest } from "./host-review-request.ts";

export class HostReviewRequestList {
  public static readonly maximumRows: number = Resources.maximumReviewRequestRows;

  private static readonly FIELDS: readonly string[] = [Resources.rowsField, Resources.hasMoreField, Resources.isSignedInField];

  public readonly rows: readonly HostReviewRequest[];
  public readonly hasMore: boolean;
  public readonly isSignedIn: boolean;

  public constructor(rows: readonly HostReviewRequest[], hasMore: boolean, isSignedIn: boolean = true, reader?: JsonReader) {
    if (rows.length > Resources.maximumReviewRequestRows || (!isSignedIn && rows.length > 0))
      FieldCheck.fail(Resources.rowsField, Resources.reviewRequestRowsExpected, reader);
    if (hasMore && !isSignedIn)
      FieldCheck.fail(Resources.hasMoreField, Resources.reviewRequestsMoreExpected, reader);

    this.rows = [...rows];
    this.hasMore = hasMore;
    this.isSignedIn = isSignedIn;
  }

  public static signedOut(): HostReviewRequestList {
    return new HostReviewRequestList([], false, false);
  }

  public static fromJson(value: unknown, path?: string): HostReviewRequestList {
    const reader = JsonReader.fromValue(value, path);
    FieldCheck.refuseUnknownFields(reader, HostReviewRequestList.FIELDS);
    return new HostReviewRequestList(
      reader.readObjectArray(Resources.rowsField).map(t => HostReviewRequest.fromJson(t.toJson(), t.path)),
      reader.readBoolean(Resources.hasMoreField),
      reader.readBoolean(Resources.isSignedInField),
      reader);
  }

  public toJson(): JsonObject {
    return {
      [Resources.rowsField]: this.rows.map(t => t.toJson()),
      [Resources.hasMoreField]: this.hasMore,
      [Resources.isSignedInField]: this.isSignedIn
    };
  }
}
