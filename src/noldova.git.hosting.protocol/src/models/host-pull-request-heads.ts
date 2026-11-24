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
import { HostPullRequestHead } from "./host-pull-request-head.ts";

export class HostPullRequestHeads {
  public static readonly maximumRows: number = Resources.maximumPullRequestHeads;

  private static readonly FIELDS: readonly string[] = [Resources.rowsField, Resources.hasMoreField, Resources.isSignedInField];

  public readonly rows: readonly HostPullRequestHead[];
  public readonly hasMore: boolean;
  public readonly isSignedIn: boolean;

  public constructor(rows: readonly HostPullRequestHead[], hasMore: boolean, isSignedIn: boolean = true, reader?: JsonReader) {
    if (rows.length > Resources.maximumPullRequestHeads || (!isSignedIn && rows.length > 0))
      FieldCheck.fail(Resources.rowsField, Resources.pullRequestHeadsExpected, reader);
    if (hasMore && rows.length < Resources.maximumPullRequestHeads)
      FieldCheck.fail(Resources.hasMoreField, Resources.pullRequestHeadsMoreExpected, reader);

    this.rows = [...rows];
    this.hasMore = hasMore;
    this.isSignedIn = isSignedIn;
  }

  public static signedOut(): HostPullRequestHeads {
    return new HostPullRequestHeads([], false, false);
  }

  public static fromJson(value: unknown, path?: string): HostPullRequestHeads {
    const reader = JsonReader.fromValue(value, path);
    FieldCheck.refuseUnknownFields(reader, HostPullRequestHeads.FIELDS);
    return new HostPullRequestHeads(
      reader.readObjectArray(Resources.rowsField).map(t => HostPullRequestHead.fromJson(t.toJson(), t.path)),
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
