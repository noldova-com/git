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
import { HostPullRequestUpdate } from "./host-pull-request-update.ts";

export class HostPullRequestUpdates {
  public static readonly maximumCount: number = Resources.maximumPullRequestUpdates;

  private static readonly FIELDS: readonly string[] = [Resources.updatesField, Resources.hasMoreField];

  public readonly updates: readonly HostPullRequestUpdate[];
  public readonly hasMore: boolean;

  public constructor(updates: readonly HostPullRequestUpdate[], hasMore: boolean, reader?: JsonReader) {
    if (updates.length > Resources.maximumPullRequestUpdates)
      FieldCheck.fail(Resources.updatesField, Resources.pullRequestUpdatesExpected, reader);
    if (hasMore && updates.length < Resources.maximumPullRequestUpdates)
      FieldCheck.fail(Resources.hasMoreField, Resources.pullRequestUpdatesMoreExpected, reader);

    this.updates = [...updates];
    this.hasMore = hasMore;
  }

  public static fromJson(value: unknown, path?: string): HostPullRequestUpdates {
    const reader = JsonReader.fromValue(value, path);
    FieldCheck.refuseUnknownFields(reader, HostPullRequestUpdates.FIELDS);
    return new HostPullRequestUpdates(reader.readObjectArray(Resources.updatesField).map(t => HostPullRequestUpdate.fromJson(t.toJson(), t.path)),
      reader.readBoolean(Resources.hasMoreField), reader);
  }

  public toJson(): JsonObject {
    return { [Resources.updatesField]: this.updates.map(t => t.toJson()), [Resources.hasMoreField]: this.hasMore };
  }
}
