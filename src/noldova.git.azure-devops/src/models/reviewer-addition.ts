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

export class ReviewerAddition {
  public readonly reference: HostReference;
  public readonly descriptor: string;

  public constructor(reference: HostReference, descriptor: string) {
    this.reference = reference;
    this.descriptor = descriptor;
  }

  public static fromJson(value: unknown): ReviewerAddition | null {
    const reader: JsonReader = JsonReader.fromValue(value);
    const reference: HostReference = HostReference.fromJson(reader.readObject(Resources.referenceField).toJson());
    const descriptor: string = reader.readString(Resources.descriptorField);
    return Resources.isOwnReference(reference) && Resources.descriptorPattern.test(descriptor) ? new ReviewerAddition(reference, descriptor) : null;
  }
}
