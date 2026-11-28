/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { type JsonObject, JsonReader } from "@noldova/context.json";

import { DiffScopeKind } from "../enums/diff-scope-kind.ts";
import { Resources } from "../resources.ts";
import { FieldCheck } from "./field-check.ts";

export class DiffScope {
  private static readonly FIELDS: readonly string[] = [Resources.kindField, Resources.fromField, Resources.toField];

  public readonly kind: DiffScopeKind;
  public readonly from: string | undefined;
  public readonly to: string | undefined;

  public constructor(kind: DiffScopeKind, from?: string, to?: string, reader?: JsonReader) {
    for (const [value, field] of [[from, Resources.fromField], [to, Resources.toField]] as const) {
      if ((kind === DiffScopeKind.Range) !== (!Object.isUndefined(value)) || value === "")
        FieldCheck.fail(field, Resources.scopeRevisionExpected, reader);
      if (!Object.isUndefined(value))
        FieldCheck.requireNoNul(value, field, reader);
    }

    this.kind = kind;
    this.from = from;
    this.to = to;
  }

  public static fromJson(value: unknown, path?: string): DiffScope {
    const reader = JsonReader.fromValue(value, path);
    FieldCheck.refuseUnknownFields(reader, DiffScope.FIELDS);
    return new DiffScope(
      reader.readOneOf(Resources.kindField, Object.values(DiffScopeKind)),
      reader.readOptionalString(Resources.fromField),
      reader.readOptionalString(Resources.toField),
      reader);
  }

  public toJson(): JsonObject {
    return {
      [Resources.kindField]: this.kind,
      ...Object.isUndefined(this.from) ? {} : { [Resources.fromField]: this.from },
      ...Object.isUndefined(this.to) ? {} : { [Resources.toField]: this.to }
    };
  }
}
