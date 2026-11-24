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

export class PeopleQuery {
  public readonly reference: HostReference;
  public readonly query: string;

  public constructor(reference: HostReference, query: string) {
    this.reference = reference;
    this.query = query;
  }

  public static fromJson(value: unknown): PeopleQuery | null {
    const reader: JsonReader = JsonReader.fromValue(value);
    const reference: HostReference = HostReference.fromJson(reader.readObject(Resources.referenceField).toJson());
    const query: string = reader.readString(Resources.queryField).trim();
    return Resources.isOwnReference(reference) && query.length >= Resources.minimumPeopleQuery && query.length <= Resources.maximumPeopleQuery
      ? new PeopleQuery(reference, query) : null;
  }
}
