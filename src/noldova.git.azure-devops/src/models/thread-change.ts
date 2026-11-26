/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { JsonReader } from "@noldova/context.json";
import { HostReference, ThreadStatus } from "@noldova/git.hosting.protocol";

import { Resources } from "../resources.ts";
import type { ThreadWrite } from "../types/thread-write.ts";

export class ThreadChange {
  private static readonly STATES: readonly ThreadWrite[] = [ThreadStatus.Active, ThreadStatus.Resolved];

  public readonly reference: HostReference;
  public readonly thread: number;
  public readonly state: ThreadWrite;

  public constructor(reference: HostReference, thread: number, state: ThreadWrite) {
    this.reference = reference;
    this.thread = thread;
    this.state = state;
  }

  public static fromJson(value: unknown): ThreadChange | null {
    const reader: JsonReader = JsonReader.fromValue(value);
    const reference: HostReference = HostReference.fromJson(reader.readObject(Resources.referenceField).toJson());
    const thread: number = reader.readInteger(Resources.threadField);
    const state: ThreadWrite = reader.readOneOf(Resources.stateField, ThreadChange.STATES);
    return Resources.isOwnReference(reference) && thread > 0 ? new ThreadChange(reference, thread, state) : null;
  }
}
