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

export class GitHooks {
  private static readonly FIELDS: readonly string[] = [Resources.hooksField];

  public readonly hooks: readonly string[];

  public constructor(hooks: readonly string[], reader?: JsonReader) {
    hooks.forEach((name, index) => FieldCheck.requireText(name, Resources.formatItemField(Resources.hooksField, index), reader));
    this.hooks = hooks;
  }

  public static fromJson(value: unknown, path?: string): GitHooks {
    const reader = JsonReader.fromValue(value, path);
    FieldCheck.refuseUnknownFields(reader, GitHooks.FIELDS);
    return new GitHooks(reader.readStringArray(Resources.hooksField), reader);
  }

  public toJson(): JsonObject {
    return { [Resources.hooksField]: [...this.hooks] };
  }
}
