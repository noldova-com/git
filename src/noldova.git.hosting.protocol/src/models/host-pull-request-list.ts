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
import { HostPullRequestRow } from "./host-pull-request-row.ts";

export class HostPullRequestList {
  public static readonly maximumRows: number = Resources.maximumPullRequestRows;

  private static readonly FIELDS: readonly string[] = [Resources.rowsField, Resources.hasMoreField, Resources.isSignedInField];

  public readonly rows: readonly HostPullRequestRow[];
  public readonly hasMore: boolean;
  public readonly isSignedIn: boolean;

  public constructor(rows: readonly HostPullRequestRow[], hasMore: boolean, isSignedIn: boolean = true, reader?: JsonReader) {
    if (rows.length > Resources.maximumPullRequestRows || (!isSignedIn && rows.length > 0))
      FieldCheck.fail(Resources.rowsField, Resources.rowsExpected, reader);
    if (hasMore && rows.length < Resources.maximumPullRequestRows)
      FieldCheck.fail(Resources.hasMoreField, Resources.hasMoreExpected, reader);

    this.rows = [...rows];
    this.hasMore = hasMore;
    this.isSignedIn = isSignedIn;
  }

  public static signedOut(): HostPullRequestList {
    return new HostPullRequestList([], false, false);
  }

  public static fromJson(value: unknown, path?: string): HostPullRequestList {
    const reader = JsonReader.fromValue(value, path);
    FieldCheck.refuseUnknownFields(reader, HostPullRequestList.FIELDS);
    return new HostPullRequestList(
      reader.readObjectArray(Resources.rowsField).map(t => HostPullRequestRow.fromJson(t.toJson(), t.path)),
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
