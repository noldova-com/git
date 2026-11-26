/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { JsonReader, type JsonValue } from "@noldova/context.json";

export class GitWindowStorage {
  public static readArray(key: string): readonly JsonValue[] {
    try {
      const value: JsonValue = JsonReader.parseValue(localStorage.getItem(key) ?? "[]");
      return Array.isArray(value) ? value : [];
    }
    catch {
      return [];
    }
  }

  public static write(key: string, value: JsonValue): void {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    }
    catch {
    }
  }
}
