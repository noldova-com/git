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
import { HostThread } from "./host-thread.ts";

export class HostPullRequestThreads {
  private static readonly FIELDS: readonly string[] = [Resources.threadsField, Resources.hasMoreField];

  public readonly threads: readonly HostThread[];
  public readonly hasMore: boolean;

  public constructor(threads: readonly HostThread[], hasMore: boolean) {
    this.threads = [...threads];
    this.hasMore = hasMore;
  }

  public static fromJson(value: unknown, path?: string): HostPullRequestThreads {
    const reader = JsonReader.fromValue(value, path);
    FieldCheck.refuseUnknownFields(reader, HostPullRequestThreads.FIELDS);
    return new HostPullRequestThreads(reader.readObjectArray(Resources.threadsField).map(t => HostThread.fromJson(t.toJson(), t.path)),
      reader.readBoolean(Resources.hasMoreField));
  }

  public toJson(): JsonObject {
    return { [Resources.threadsField]: this.threads.map(t => t.toJson()), [Resources.hasMoreField]: this.hasMore };
  }
}
