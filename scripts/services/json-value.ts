/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { JsonFileMalformedException } from "../exceptions/json-file-malformed.exception.ts";
import { JsonValueNotObjectException } from "../exceptions/json-value-not-object.exception.ts";
import { JsonValueNotTextException } from "../exceptions/json-value-not-text.exception.ts";
import { Resources } from "../resources.ts";

export type JsonObject = { readonly [key: string]: unknown };

export class JsonValue {
  public static isObject(value: unknown): value is JsonObject {
    return typeof value === "object" && value !== null && !Array.isArray(value);
  }

  public static parseFile(file: string, text: string): unknown {
    try {
      return JSON.parse(text);
    }
    catch (error) {
      if (!(error instanceof SyntaxError))
        throw error;
      throw new JsonFileMalformedException(file, error);
    }
  }

  public static object(value: unknown, context: string): JsonObject {
    if (!JsonValue.isObject(value))
      throw new JsonValueNotObjectException(context);
    return value;
  }

  public static child(source: JsonObject, key: string, context: string): JsonObject {
    return JsonValue.object(source[key], Resources.formatJsonPath(context, key));
  }

  public static nullableChild(source: JsonObject, key: string, context: string): JsonObject | null {
    return source[key] === null ? null : JsonValue.child(source, key, context);
  }

  public static text(source: JsonObject, key: string, context: string): string {
    const value = source[key];
    if (typeof value !== "string")
      throw new JsonValueNotTextException(Resources.formatJsonPath(context, key));
    return value;
  }
}
