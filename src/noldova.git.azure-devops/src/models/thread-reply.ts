/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { JsonReader } from "@noldova/context.json";
import { HostReference } from "@noldova/git.hosting.protocol";

import { Resources } from "../resources.ts";

export class ThreadReply {
  public readonly reference: HostReference;
  public readonly thread: number;
  public readonly parent: number;
  public readonly body: string;

  public constructor(reference: HostReference, thread: number, parent: number, body: string) {
    this.reference = reference;
    this.thread = thread;
    this.parent = parent;
    this.body = body;
  }

  public static fromJson(value: unknown): ThreadReply | null {
    const reader: JsonReader = JsonReader.fromValue(value);
    const reference: HostReference = HostReference.fromJson(reader.readObject(Resources.referenceField).toJson());
    const thread: number = reader.readInteger(Resources.threadField);
    const parent: number = reader.readInteger(Resources.replyParentField);
    const body: string = reader.readNonBlankString(Resources.bodyField);
    return Resources.isOwnReference(reference) && thread > 0 && parent > 0 && body.length <= Resources.maximumCommentLength
      ? new ThreadReply(reference, thread, parent, body) : null;
  }
}
